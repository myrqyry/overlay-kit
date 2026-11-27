import {
  connectKickChat, connectYouTubeChat, connectTikTokChat,
  fetchGlobalSevenTv, fetchKickChannelSevenTv, mergeCandidates, resolveKickChannel,
  type ChatConnectionState, type ChatEvent,
} from '@myrqyry/chatbus';
import {createBrowserChatSource} from '@myrqyry/chatbus/browser';
import { connectYouTubeInnertubeChat } from '@myrqyry/chatbus/youtube-innertube';
import type {LivePlatform} from '../src/live-platform';
import type {LiveSource} from './live-hub';
export * from './live-hub';

export const twitchChatbusSource:LiveSource=createBrowserChatSource();

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
