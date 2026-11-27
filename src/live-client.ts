import type { DisplayMessage,DisplayBadge,DisplayNamePaint } from './chatbus';
import type { OverlayLiveEvent } from './live';
import { normalizeViewerChannel,normalizeViewerPlatform,type ViewerPlatform } from './channel-choice';
import type { SocialSignalV1 } from '@myrqyry/chatbus';
export interface LiveConsumer {
  receive(message: DisplayMessage): unknown;
  updateBadges?(messageId:string,badges:readonly DisplayBadge[]):unknown;
  updateIdentity?(messageId:string,identity:{badges:readonly DisplayBadge[];namePaint?:DisplayNamePaint}):unknown;
  removeMessage(messageId: string): unknown;
  removeUser(target: { sourceId?:string; userId?: string; username?: string }): unknown;
  removeSource?(sourceId:string):unknown;
  clear(): void;
}
export function applyLiveEvent(consumer: LiveConsumer, event: OverlayLiveEvent): void {
  switch (event.type) {
    case 'message': consumer.receive(event.message); break;
    case 'badges': consumer.updateBadges?.(event.messageId,event.badges); break;
    case 'identity': consumer.updateIdentity?.(event.messageId,event); break;
    case 'delete': consumer.removeMessage(event.messageId); break;
    case 'user-clear': consumer.removeUser(event); break;
    case 'clear': event.sourceId ? consumer.removeSource?.(event.sourceId) : consumer.clear(); break;
  }
}
export interface WireLiveSourceStatus {
  platform?: ViewerPlatform|null;
  channel: string | null;
  state: 'idle'|'connecting'|'connected'|'reconnecting'|'disconnected'|'error';
  emotes: 'idle'|'loading'|'ready'|'degraded';
  badges: 'idle'|'loading'|'ready'|'degraded';
  error: string | null;
}
export interface WireLiveStatus extends WireLiveSourceStatus {
  sources?:WireLiveSourceStatus[];
}
/** An independent source client: WebSocket receives a server-owned stream.
 * It never needs the editor or its BroadcastChannel to stay open. */
export function connectLiveSource(
  onEvent: (event: OverlayLiveEvent) => void,
  onStatus?: (status: WireLiveStatus) => void,
  onSignal?: (signal: SocialSignalV1) => void,
  options?: {endpoint?: '/live' | '/api/live';platform?:ViewerPlatform;channel?:string},
) {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  const target = new URL(options?.endpoint??'/live', location.href);
  target.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if(options?.endpoint==='/api/live' && options.channel){
    const platform=normalizeViewerPlatform(options.platform)??'twitch';
    const selected=normalizeViewerChannel(options.channel,platform);
    if(selected){
      target.searchParams.set('channel',selected);
      if(platform!=='twitch')target.searchParams.set('platform',platform);
    }
  }
  const open = () => {
    if (disposed) return;
    try {
      socket = new WebSocket(target.toString());
    } catch { schedule(); return; }
    const current = socket;
    current.onopen = () => { if (socket === current) attempts = 0; };
    current.onmessage = msg => {
      if (socket !== current || typeof msg.data !== 'string') return;
      let packet: unknown;
      try { packet = JSON.parse(msg.data); } catch { return; }
      if (!packet || typeof packet !== 'object') return;
      const result = packet as {
        type?: string; event?: OverlayLiveEvent; status?: WireLiveStatus; signal?: SocialSignalV1;
      };
      if (result.type === 'status' && result.status) onStatus?.(result.status);
      if (result.type === 'event' && result.event) onEvent(result.event);
      if (result.type === 'signal' && result.signal) onSignal?.(result.signal);
    };
    current.onclose = () => {
      if(socket!==current)return;
      socket=null;
      if(options?.endpoint==='/api/live')onStatus?.({platform:options.platform,channel:options.channel??null,
        state:'reconnecting',emotes:'idle',badges:'idle',error:null});
      schedule();
    };
    current.onerror = () => current.close();
  };
  const schedule = () => {
    if (disposed || retry) return;
    const backoff = Math.min(15000, 500 * 2 ** Math.min(attempts++, 5));
    retry = setTimeout(() => {retry = null;open();},backoff);
  };
  open();
  return {
    dispose() {
      disposed = true;
      if (retry) clearTimeout(retry);
      const old = socket;
      socket = null;
      if (old) {old.onopen = old.onmessage = old.onclose = old.onerror = null;old.close();}
    },
  };
}

export interface LiveCapability {
  mode: 'local'|'hosted';
  platform: ViewerPlatform;
  platforms: ViewerPlatform[];
  channel: string|null;
  websocketPath: '/live'|'/api/live';
}
/** Discover the actual server before opening a WebSocket. Cloud URLs cannot
 * redirect the live socket to an attacker-controlled endpoint. */
export async function getLiveCapability():Promise<LiveCapability|null> {
  try {
    const res=await fetch('/api/live/status',{headers:{Accept:'application/json'}});
    if(!res.ok||!res.headers.get('content-type')?.includes('application/json'))return null;
    const value:unknown=await res.json();
    if(!value||typeof value!=='object')return null;
    const data=value as {service?:unknown;mode?:unknown;platform?:unknown;platforms?:unknown;channel?:unknown;websocketPath?:unknown};
    if(data.service!=='overlay-kit-live')return null;
    if(data.mode==='hosted'){
      if(data.websocketPath!=='/api/live')return null;
      const platform=normalizeViewerPlatform(data.platform)??'twitch';
      const platforms=Array.isArray(data.platforms)
        ? data.platforms.flatMap(value=>{const item=normalizeViewerPlatform(value);return item?[item]:[]})
        : ['twitch','kick','youtube'] as ViewerPlatform[];
      return {mode:'hosted',platform,platforms,channel:typeof data.channel==='string'?data.channel:null,
        websocketPath:'/api/live'};
    }
    const platforms=Array.isArray(data.platforms)
      ? data.platforms.flatMap(value=>{const item=normalizeViewerPlatform(value);return item?[item]:[]})
      : ['twitch','kick','youtube'] as ViewerPlatform[];
    return {mode:'local',platform:normalizeViewerPlatform(data.platform)??'twitch',platforms,channel:null,websocketPath:'/live'};
  }catch{return null;}
}
/** Compatibility helper for local clients. */
export async function hasLiveServer():Promise<boolean> {
  return (await getLiveCapability())!==null;
}
