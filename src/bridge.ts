import type { DisplayMessage } from './chatbus';

/** Same-origin tab/OBS delivery, not external chat transport or authentication. */
export interface ChannelLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(value: unknown): void;
  close(): void;
}
type ChannelCtor = new (name: string) => ChannelLike;
export type OverlayBridgeEvent = { type: 'message'; message: DisplayMessage };

function validMessage(value: unknown): value is DisplayMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<DisplayMessage>;
  if (typeof m.id !== 'string' || !m.id || typeof m.timestamp !== 'number'
      || !Number.isFinite(m.timestamp)
      || !m.user || typeof m.user.name !== 'string' || !Array.isArray(m.user.badges)
      || !Array.isArray(m.parts) || m.user.badges.length > 50 || m.parts.length > 500) return false;
  const isRecord = (x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null && !Array.isArray(x);
  const hasString = (obj: Record<string, unknown>, key: string): boolean =>
    typeof obj[key] === 'string';
  if (!m.user.badges.every(b => {
    if(!isRecord(b) || !hasString(b,'name'))return false;
    const url=b.url;const text=b.text;
    return (typeof url==='string' && url.length<=2048) ||
      (typeof text==='string' && text.length<=24 && /^[A-Z0-9 ]+$/.test(text));
  })) return false;
  return m.parts.every(part => {
    if (!isRecord(part)) return false;
    if (part.type === 'text') return hasString(part, 'text');
    if(part.type==='mention')return hasString(part,'text') &&
      (part.username===undefined||(typeof part.username==='string'&&part.username.length<=128)) &&
      (part.userId===undefined||(typeof part.userId==='string'&&part.userId.length<=128));
    if(part.type==='media'){
      if(!hasString(part,'text') || !hasString(part,'url') ||
        (part.mediaType!=='gif'&&part.mediaType!=='image') ||
        !(part.url as string).length || (part.url as string).length>4096 ||
        (part.alt!==undefined && (typeof part.alt!=='string'||part.alt.length>300)))return false;
      try{
        const url=new URL(part.url as string,'https://overlay.invalid');
        return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password;
      }catch{return false;}
    }
    if (part.type !== 'emote' || !isRecord(part.emote)) return false;
    const art = part.emote;
    return hasString(art, 'id') && hasString(art, 'code') && hasString(art, 'url')
      && Array.isArray(art.overlays) && art.overlays.length <= 32
      && art.overlays.every((x: unknown) => isRecord(x) && hasString(x, 'code') && hasString(x, 'url'))
      && Array.isArray(art.modifiers) && art.modifiers.length <= 32
      && art.modifiers.every((x: unknown) => isRecord(x) && hasString(x, 'code')
        && typeof x.flags === 'number' && Number.isSafeInteger(x.flags));
  });
}

export function createOverlayBridge(
  channelName: string,
  onEvent: (event: OverlayBridgeEvent) => void,
  Constructor: ChannelCtor = BroadcastChannel,
) {
  const channel = new Constructor(channelName);
  let disposed = false;
  channel.onmessage = event => {
    if (disposed) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const packet = data as { type?: unknown; message?: unknown };
    if (packet.type === 'message' && validMessage(packet.message)) {
      onEvent({ type: 'message', message: packet.message });
    }
  };
  return {
    publish(message: DisplayMessage) {
      if (!disposed && validMessage(message)) {
        channel.postMessage({ type: 'message', message });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      channel.onmessage = null;
      channel.close();
    },
  };
}
