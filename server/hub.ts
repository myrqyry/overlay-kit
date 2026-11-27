import {
  connectKickChat, connectTwitchIrcChat, connectYouTubeChat, connectTikTokChat,
  fetchChannelEmotesDetailed, fetchGlobalSevenTv, fetchKickChannelSevenTv,
  mergeBadges, mergeCandidates, resolveKickChannel,
  createKickBadgeCatalog, type KickBadgeCatalog,
  type Badge, type BadgeRef,
  type ChatConnectionState, type ChatEvent, type EmoteSet,
} from '@myrqyry/chatbus';
import { connectYouTubeInnertubeChat } from '@myrqyry/chatbus/youtube-innertube';
import { fromChatbusEvent,fromChatbusSignal, type OverlayLiveEvent } from '../src/live';
import { projectDisplayBadges,projectNamePaint } from '../src/chatbus';
import type { ResolvedCosmetics, CosmeticResolver } from './cosmetics';
import type { SocialSignalV1 } from '@myrqyry/chatbus';
import { createTwitchBadgeCatalog, type TwitchBadgeCatalog } from './twitch-badges';
import {createTwitchViewerAvatarLookup} from './twitch-viewer-avatars';
import {normalizeLiveChannel,type LivePlatform} from '../src/live-platform';

export type HubState = ChatConnectionState;
export interface LiveHubStatus {
  platform: LivePlatform|null;
  channel: string | null;
  state: HubState;
  emotes: 'idle' | 'loading' | 'ready' | 'degraded';
  badges: 'idle' | 'loading' | 'ready' | 'degraded';
  error: string | null;
}
export type ServerPacket =
  | { type: 'event'; event: OverlayLiveEvent }
  | { type: 'signal'; signal: SocialSignalV1 }
  | { type: 'status'; status: LiveHubStatus };

export interface LiveSource {
  connect(options: {
    platform?: LivePlatform;
    channel: string;
    getEmotes: () => EmoteSet;
    onEvent: (event: ChatEvent) => void;
    onStateChange?: (state: ChatConnectionState) => void;
    onError?: (error: Error) => void;
  }): { close(): void };
  emotes(channel: string, platform?:LivePlatform): Promise<{ emotes: EmoteSet; complete: boolean }>;
}
export const twitchChatbusSource: LiveSource = {
  connect: ({platform:_platform,...options}) => connectTwitchIrcChat(options),
  emotes: (channel) => fetchChannelEmotesDetailed(channel),
};

export const kickChatbusSource:LiveSource={
  connect(options){
    const controller=new AbortController();
    let closed=false;
    let active:{close():void}|null=null;
    void connectKickChat({
      channel:options.channel,
      getEmotes:options.getEmotes,
      emitInitialHistory:true,
      initialHistoryLimit:20,
      signal:controller.signal,
      onEvent:options.onEvent,
      onStateChange:options.onStateChange,
      onError:options.onError,
    }).then(connection=>{
      if(closed)connection.close();
      else active=connection;
    },error=>{
      if(closed||controller.signal.aborted)return;
      options.onStateChange?.('error');
      options.onError?.(error instanceof Error?error:new Error('Kick connection failed'));
    });
    return {close(){
      if(closed)return;
      closed=true;
      controller.abort();
      active?.close();
      active=null;
    }};
  },
  async emotes(channel){
    const resolved=await resolveKickChannel(channel);
    const global=fetchGlobalSevenTv();
    const kick=resolved.channelId
      ? fetchKickChannelSevenTv(resolved.channelId)
      : Promise.resolve({candidates:[],status:{provider:'7tv' as const,scope:'channel' as const,ok:true,count:0}});
    const results=await Promise.all([global,kick]);
    return {
      emotes:mergeCandidates(results.flatMap(result=>result.candidates)),
      complete:results.every(result=>result.status.ok),
    };
  },
};

export function createYouTubeSource(
  credentials:{accessToken?:string;apiKey?:string},
  connectPublic:typeof connectYouTubeInnertubeChat=connectYouTubeInnertubeChat,
):LiveSource{return {
  connect(options){
    const controller=new AbortController();
    let closed=false;
    let active:{close():void}|null=null;
    const apiKey=credentials.apiKey?.trim()||undefined;
    const accessToken=credentials.accessToken?.trim()||undefined;
    const authenticated=Boolean(apiKey||accessToken);
    if(!authenticated && process.env.OVERLAY_YOUTUBE_PUBLIC==='0'){
      queueMicrotask(()=>{
        if(closed)return;
        options.onStateChange?.('error');
        options.onError?.(new Error('Public YouTube chat disabled; configure an API key or OAuth token'));
      });
      return {close(){closed=true;controller.abort();}};
    }
    const forwardEvent=(event:ChatEvent)=>{if(!closed)options.onEvent(event);};
    const forwardState=(state:ChatConnectionState)=>{if(!closed)options.onStateChange?.(state);};
    const forwardError=(error:Error)=>{if(!closed)options.onError?.(error);};
    // Official API remains preferred; the unofficial public reader is Node-only.
    const pending=authenticated
      ? connectYouTubeChat({
        videoId:options.channel,apiKey,accessToken,emitInitialHistory:false,
        signal:controller.signal,onEvent:forwardEvent,
        onStateChange:forwardState,onError:forwardError,
      })
      : connectPublic({
        liveId:options.channel,
        signal:controller.signal,onEvent:forwardEvent,
        onStateChange:forwardState,onError:forwardError,
      });
    void pending.then(connection=>{
      if(closed)connection.close();else active=connection;
    },error=>{
      if(closed||controller.signal.aborted)return;
      options.onStateChange?.('error');
      options.onError?.(error instanceof Error?error:new Error('YouTube Live Chat connection failed'));
    });
    return {close(){
      if(closed)return;closed=true;controller.abort();active?.close();active=null;
    }};
  },
  async emotes(){return {emotes:{},complete:true};},
};}
export const youtubeChatbusSource=createYouTubeSource({
  apiKey:process.env.OVERLAY_YOUTUBE_API_KEY,accessToken:process.env.OVERLAY_YOUTUBE_ACCESS_TOKEN,
});

export const tiktokChatbusSource:LiveSource={
  connect:({platform:_platform,...options})=>connectTikTokChat(options),
  async emotes(){return {emotes:{},complete:true};},
};
const sourcesByPlatform:Record<LivePlatform,LiveSource>={
  twitch:twitchChatbusSource,kick:kickChatbusSource,youtube:youtubeChatbusSource,tiktok:tiktokChatbusSource,
};
const sourceFor=(platform:LivePlatform):LiveSource=>sourcesByPlatform[platform];

export const chatbusLiveSource:LiveSource={
  connect(options){return sourceFor(options.platform??'twitch').connect(options);},
  emotes(channel,platform='twitch'){return sourceFor(platform).emotes(channel,platform);},
};

export function normalizeChannel(input:string,platform:LivePlatform='twitch'):string {
  const channel=normalizeLiveChannel(input,platform);
  if(!channel)throw new Error(
    platform==='kick'
      ? 'Enter a valid Kick channel slug'
      : platform==='youtube'
        ? 'Enter a valid YouTube video ID or live video URL'
        : platform==='tiktok'?'Enter a valid TikTok username or LIVE URL'
        : 'Enter a valid Twitch channel (letters, numbers or underscore)'
  );
  return channel;
}
type SourceAvatarResult=string|null|{url:string;color?:string};

export function createLiveHub(
  source: LiveSource, emit: (packet: ServerPacket) => void,
  makeBadges: () => TwitchBadgeCatalog = createTwitchBadgeCatalog,
  makeCosmetics?: () => Pick<CosmeticResolver,'resolve'> & Partial<Pick<CosmeticResolver,'close'>>,
  makeKickBadges: () => KickBadgeCatalog = createKickBadgeCatalog,
  loadTwitchAvatar?: (login:string) => Promise<SourceAvatarResult>,
  loadKickAvatar?: (slug:string) => Promise<string|null>,
  loadTwitchViewerAvatar?: (login:string) => Promise<string|null>,
) {
  let connection: {close(): void} | null = null;
  let viewerLookup:ReturnType<typeof createTwitchViewerAvatarLookup>|null=null;
  let generation = 0;
  let emotes: EmoteSet = {};
  let badgeCatalog:TwitchBadgeCatalog|null = null;
  let kickBadgeCatalog:KickBadgeCatalog|null = null;
  let cosmeticsResolver:(Pick<CosmeticResolver,'resolve'> & Partial<Pick<CosmeticResolver,'close'>>)|null=null;
  type PendingIdentity={
    refs:BadgeRef[]; badges:Badge[]; userId?:string; username:string;
    cosmetics?:ResolvedCosmetics; viewerUrl?:string;
    signature:string; addedAt:number;
  };
  const awaiting=new Map<string,PendingIdentity>();
  let status: LiveHubStatus = { platform:null,channel:null,state:'idle',emotes:'idle',badges:'idle',error:null };
  const update = (patch: Partial<LiveHubStatus>) => {
    status = { ...status, ...patch };
    emit({type:'status',status:{...status}});
  };
  const disconnect = () => {
    generation++;
    viewerLookup?.close();viewerLookup=null;
    connection?.close();
    connection = null;
    emotes = {};
    badgeCatalog = null;
    kickBadgeCatalog = null;
    cosmeticsResolver?.close?.();
    cosmeticsResolver=null;
    awaiting.clear();
    emit({type:'event',event:{type:'clear'}});
    update({platform:null,channel:null,state:'disconnected',emotes:'idle',badges:'idle',error:null});
  };
  return {
    status: () => ({...status}),
    connect(input:string,platform:LivePlatform='twitch') {
      const channel=normalizeChannel(input,platform);
      if(status.platform===platform && status.channel===channel && connection)return;
      if (connection) disconnect();
      generation++;
      const current = generation;
      emotes = {};
      awaiting.clear();
      badgeCatalog=platform==='twitch'?makeBadges():null;
      kickBadgeCatalog=platform==='kick'?makeKickBadges():null;
      cosmeticsResolver=platform==='twitch'?(makeCosmetics?.() ?? null):null;
      update({platform,channel,state:'connecting',emotes:'loading',
        badges:'loading',error:null});
      const valid=()=>generation===current && status.platform===platform && status.channel===channel;
      let sourceAvatarUrl:string|null=null;
      let sourceAvatarColor:string|undefined;
      let colorSeenInChat=false;
      const avatarLoader=platform==='twitch'?loadTwitchAvatar:
        platform==='kick'?loadKickAvatar:undefined;
      viewerLookup=platform==='twitch'&&loadTwitchViewerAvatar
        ? createTwitchViewerAvatarLookup(loadTwitchViewerAvatar):null;
      const sourceAvatarBadge=():ReturnType<typeof projectDisplayBadges> =>
        avatarLoader && sourceAvatarUrl ? [{
          provider:platform+'-source',id:'source-avatar',
          name:channel+' profile picture',url:sourceAvatarUrl,
          ...(sourceAvatarColor?{color:sourceAvatarColor}:{}),
          tooltip:channel+' on '+(platform==='twitch'?'Twitch':'Kick'),
        }] : [];
      const resolveBadges = (refs:BadgeRef[],preexisting:Badge[],cosmetics?:ResolvedCosmetics) =>
        mergeBadges(preexisting,badgeCatalog?.resolve(refs) ?? [],
          kickBadgeCatalog?.resolve(refs) ?? [],cosmetics?.badges ?? []);
      const displayBadges = (items:Badge[],refs:BadgeRef[]=[],username?:string,viewerUrl?:string) => [
        ...sourceAvatarBadge(),
        ...(viewerUrl && username && username.toLowerCase()!==channel ? [{
          provider:'twitch-user',id:'viewer-avatar',name:username+' profile picture',
          url:viewerUrl,tooltip:'@'+username+' on Twitch',
        }] : []),
        // Keep provider + stable badge ID: the browser needs those to let
        // users independently toggle native roles, subscriptions and gifts.
        ...projectDisplayBadges(items,refs),
      ];
      const refreshBadges = () => {
        if(!valid())return;
        update({badges:badgeCatalog?.health() ?? kickBadgeCatalog?.health() ?? 'idle'});
        const now=Date.now();
        for(const [id,item] of awaiting) {
          if(now-item.addedAt>60000) {awaiting.delete(id);continue;}
          const resolved=displayBadges(resolveBadges(item.refs,item.badges,item.cosmetics),item.refs,item.username,item.viewerUrl);
          const signature=JSON.stringify(resolved);
          if(signature===item.signature)continue;
          item.signature=signature;
          emit({type:'event',event:{type:'badges',messageId:id,badges:resolved}});
        }
      };
      // Refresh global once per session; the room-specific catalog starts as
      // soon as the actual IRC room-id is known, including ROOMSTATE events.
      if(badgeCatalog)void badgeCatalog.loadGlobal(refreshBadges);
      if(kickBadgeCatalog)void kickBadgeCatalog.loadChannel(channel,refreshBadges);
      // A broadcaster image identifies the owning chat source, not a chatter's
      // moderation role. Load it independently and patch currently visible rows.
      if(avatarLoader) {
        void avatarLoader(channel).then(result=>{
          if(!valid() || !result)return;
          const profile=typeof result==='string'?{url:result}:result;
          if(!profile.url)return;
          sourceAvatarUrl=profile.url;
          if(!colorSeenInChat && 'color' in profile &&
             typeof profile.color==='string' && /^#[0-9a-f]{6}$/i.test(profile.color))
            sourceAvatarColor=profile.color;
          refreshBadges();
        },()=>{ /* Optional public identity lookup must not interrupt chat. */ });
      }
      try {
        connection=source.connect({
          platform,channel,
          getEmotes: () => emotes,
          onEvent: event => {
            if(!valid())return;
            // Hand off Chatbus's own event taxonomy to future specialized
            // alert/widget consumers. Do not convert raids into synthetic chat rows.
            try { emit(fromChatbusSignal(event)); } catch { /* invalid upstream timestamp */ }
            const roomId=event.channelId ?? event.message?.channelId;
            if(roomId && badgeCatalog) void badgeCatalog.loadChannel(roomId,refreshBadges);
            if(event.type==='message-delete') {
              const data=event.data as {messageId?:unknown}|undefined;
              if(typeof data?.messageId==='string')awaiting.delete(data.messageId);
            }
            if(event.type==='system' && (event.data as {kind?:string}|undefined)?.kind==='chat-clear')awaiting.clear();
            if(event.type==='user-ban'||event.type==='user-timeout' ||
              (event.type==='system' && (event.data as {kind?:string}|undefined)?.kind==='chat-clear-user')) {
              for(const [id,item] of awaiting) {
                if((event.user?.id && event.user.id===item.userId) ||
                   (event.user?.username && event.user.username.toLowerCase()===item.username.toLowerCase()))
                  awaiting.delete(id);
              }
            }
            const message=event.message;
            if(message?.user.username.toLowerCase()===channel &&
               typeof message.user.color==='string' &&
               /^#[0-9a-f]{6}$/i.test(message.user.color)) {
              // Source-owner chat events can supply a newer color, including
              // Kick channels that only provide a portrait in their profile.
              colorSeenInChat=true;
              if(sourceAvatarColor!==message.user.color){
                sourceAvatarColor=message.user.color;
                if(sourceAvatarUrl)refreshBadges();
              }
            }
            const refs=message?.user.badgeRefs ?? [];
            const existing=message?.user.badges ?? [];
            const resolved=resolveBadges(refs,existing);
            const enriched=message && refs.length ? {
              ...event,message:{...message,user:{...message.user,badges:resolved}},
            } : event;
            const converted=fromChatbusEvent(enriched);
            if(converted?.type==='message' && sourceAvatarUrl)
              converted.message.user.badges=displayBadges(resolved,refs);
            if(converted)emit({type:'event',event:converted});
            if(converted?.type==='message' && message &&
                (refs.length || cosmeticsResolver || avatarLoader)) {
              const id=converted.message.id;
              const value:PendingIdentity={
                refs:[...refs], badges:[...existing],userId:message.user.id,
                username:message.user.username,
                signature:JSON.stringify(converted.message.user.badges),addedAt:Date.now(),
              };
              awaiting.set(id,value);
              while(awaiting.size>300) awaiting.delete(awaiting.keys().next().value!);
              // An IRC chat event carries a login, not its profile image.
              // Resolve individual viewer artwork independently from the source icon,
              // then patch only still-live message rows. The lookup is queue-bounded
              // and cached per source, so chat delivery stays immediate.
              if(viewerLookup && event.platform==='twitch' &&
                 message.user.username.toLowerCase()!==channel){
                void viewerLookup.get(message.user.username).then(image=>{
                  if(!valid()||!image||awaiting.get(id)!==value)return;
                  value.viewerUrl=image;
                  const full=displayBadges(
                    resolveBadges(value.refs,value.badges,value.cosmetics),
                    value.refs,value.username,value.viewerUrl);
                  const signature=JSON.stringify(full);
                  if(signature!==value.signature){
                    value.signature=signature;
                    emit({type:'event',event:{type:'badges',messageId:id,badges:full}});
                  }
                });
              }
              const provider=cosmeticsResolver;
              if(provider && event.platform === 'twitch') {
                void provider.resolve({id:message.user.id,username:message.user.username}).then(cosmetics=>{
                  if(!valid() || !cosmetics || awaiting.get(id)!==value)return;
                  const retained=awaiting.get(id)!;
                  retained.cosmetics=cosmetics;
                  const full=displayBadges(resolveBadges(retained.refs,retained.badges,cosmetics),retained.refs,retained.username,retained.viewerUrl);
                  const signature=JSON.stringify(full);
                  const namePaint=projectNamePaint(cosmetics.namePaint);
                  if(signature!==retained.signature || namePaint) {
                    retained.signature=signature;
                    emit({type:'event',event:{type:'identity',messageId:id,badges:full,
                      ...(namePaint?{namePaint}:{})}});
                  }
                },()=>{ /* optional provider unavailable; chat remains live */ });
              }
            }
          },
          onStateChange: state => {
            if(valid())update(state==='connected'?{state,error:null}:{state});
          },
          onError: error => { if (valid()) update({error:error.message}); },
        });
      } catch (error) {
        if (valid()) update({state:'error',emotes:'degraded',error:error instanceof Error? error.message:'Connection failed'});
        throw error;
      }
      void source.emotes(channel,platform).then(result => {
        if (!valid()) return;
        emotes = result.emotes;
        update({emotes:result.complete?'ready':'degraded'});
      }, error => {
        if (valid()) update({emotes:'degraded',error:error instanceof Error?error.message:'Emote loading failed'});
      });
    },
    disconnect,
    close: disconnect,
  };
}

export interface LiveMixerStatus extends LiveHubStatus {
  sources: LiveHubStatus[];
}

/** Compose several independently owned Chatbus sources into one normalized stream.
 * Each child keeps its own provider enrichment/lifecycle; the mixer only merges
 * packets and source status. */
export function createLiveMixer(
  source:LiveSource,
  emit:(packet:ServerPacket)=>void,
  makeBadges:()=>TwitchBadgeCatalog=createTwitchBadgeCatalog,
  makeCosmetics?:()=>Pick<CosmeticResolver,'resolve'> & Partial<Pick<CosmeticResolver,'close'>>,
  makeKickBadges:()=>KickBadgeCatalog=createKickBadgeCatalog,
  loadTwitchAvatar?: (login:string)=>Promise<SourceAvatarResult>,
  loadKickAvatar?: (slug:string)=>Promise<string|null>,
  loadTwitchViewerAvatar?: (login:string)=>Promise<string|null>,
){
  const hubs=new Map<string,ReturnType<typeof createLiveHub>>();
  const keyFor=(channel:string,platform:LivePlatform)=>platform+':'+channel;
  const aggregate=():LiveMixerStatus=>{
    const sources=[...hubs.values()].map(hub=>hub.status());
    const connected=sources.filter(item=>item.state==='connected').length;
    const state:HubState=sources.some(item=>item.state==='error')?'error'
      :sources.some(item=>item.state==='connecting'||item.state==='reconnecting')?'connecting'
      :connected?'connected':sources.length?'disconnected':'idle';
    const readiness=(key:'emotes'|'badges')=>sources.some(item=>item[key]==='degraded')?'degraded'
      :sources.some(item=>item[key]==='loading')?'loading'
      :sources.length&&sources.every(item=>item[key]==='ready')?'ready':'idle';
    const only=sources.length===1?sources[0]:undefined;
    return {platform:only?.platform??null,channel:only?.channel??null,state,
      emotes:readiness('emotes'),badges:readiness('badges'),
      error:sources.find(item=>item.error)?.error??null,sources};
  };
  const emitStatus=()=>emit({type:'status',status:aggregate()});
  const addSource=(input:string,platform:LivePlatform='twitch')=>{
    const channel=normalizeChannel(input,platform);
    const key=keyFor(channel,platform);
    if(hubs.has(key))return false;
    let child!:ReturnType<typeof createLiveHub>;
    child=createLiveHub(source,packet=>{
      if(packet.type==='status'){emitStatus();return;}
      if(packet.type!=='event'){emit(packet);return;}
      const event=packet.event;
      if(event.type==='message'){
        emit({type:'event',event:{type:'message',message:{...event.message,
          id:key+':'+event.message.id,sourceId:key}}});
        return;
      }
      if(event.type==='badges'||event.type==='identity'||event.type==='delete'){
        emit({type:'event',event:{...event,messageId:key+':'+event.messageId}} as ServerPacket);
        return;
      }
      if(event.type==='clear'||event.type==='user-clear'){
        emit({type:'event',event:{...event,sourceId:key}});
        return;
      }
      emit(packet);
    },makeBadges,makeCosmetics,makeKickBadges,loadTwitchAvatar,loadKickAvatar,loadTwitchViewerAvatar);
    hubs.set(key,child);
    try{child.connect(channel,platform);}catch(error){hubs.delete(key);child.close();throw error;}
    emitStatus();
    return true;
  };
  const removeSource=(input:string,platform:LivePlatform='twitch')=>{
    const channel=normalizeChannel(input,platform);
    const key=keyFor(channel,platform);
    const child=hubs.get(key);
    if(!child)return false;
    hubs.delete(key);
    child.disconnect();
    emitStatus();
    return true;
  };
  const reconnectSource=(input:string,platform:LivePlatform='twitch')=>{
    const channel=normalizeChannel(input,platform);
    if(!hubs.has(keyFor(channel,platform)))return false;
    removeSource(channel,platform);
    return addSource(channel,platform);
  };
  const disconnect=()=>{
    if(!hubs.size)return;
    for(const child of hubs.values())child.close();
    hubs.clear();
    emit({type:'event',event:{type:'clear'}});
    emitStatus();
  };
  const connect=(input:string,platform:LivePlatform='twitch')=>{
    disconnect();
    return addSource(input,platform);
  };
  return {status:aggregate,connect,addSource,removeSource,reconnectSource,disconnect,close:disconnect};
}
