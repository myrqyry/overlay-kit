import {browserPublicPlatforms,createBrowserChatSource,supportsBrowserPublicChat} from '@myrqyry/chatbus/browser';
import type {SocialSignalV1} from '@myrqyry/chatbus';
import {createLiveMixer,type LiveSource} from '../server/live-hub';
import {createUserCosmeticsResolver} from '../server/cosmetics';
import {createTwitchBadgeCatalog} from '../server/twitch-badges';
import {fetchTwitchUserAvatar} from '@myrqyry/chatbus';
import {loadTwitchSourcePortrait} from '../server/twitch-source-identity';
import {getLiveCapability,connectLiveSource,type LiveCapability,type WireLiveStatus} from './live-client';
import type {ViewerSource,ViewerPlatform} from './channel-choice';
import type {OverlayLiveEvent} from './live';

export interface BrowserCapability {
 mode:'browser';platform:ViewerPlatform;platforms:ViewerPlatform[];channel:null;
}
export type PreferredLiveCapability=LiveCapability|BrowserCapability;
/** Explicit static build: no same-origin API expected. Existing local and
 * hosted builds keep their original server discovery and behavior. */
export async function getPreferredLiveCapability(browserOnly=import.meta.env.VITE_OVERLAY_BROWSER_ONLY==='1'):Promise<PreferredLiveCapability|null>{
 if(browserOnly)return {mode:'browser',platform:'twitch',platforms:[...browserPublicPlatforms],channel:null};
 return getLiveCapability();
}
export function connectBrowserLiveSource(
 onEvent:(event:OverlayLiveEvent)=>void,
 onStatus:((status:WireLiveStatus)=>void)|undefined,
 onSignal:((signal:SocialSignalV1)=>void)|undefined,
 selection:ViewerSource,
 source?:LiveSource,
){
 let disposed=false;
 const mixer=createLiveMixer(source??createBrowserChatSource(),packet=>{
  if(disposed)return;
  if(packet.type==='event')onEvent(packet.event);
  else if(packet.type==='signal')onSignal?.(packet.signal);
  else {
   const status=packet.status;
   onStatus?.({...status,platform:status.platform??undefined,sources:'sources' in status?(status as import('../server/live-hub').LiveMixerStatus).sources.map(item=>({...item,platform:item.platform??undefined})):undefined});
  }
 },source?()=>createTwitchBadgeCatalog(async()=>[]):createTwitchBadgeCatalog,
 source?undefined:createUserCosmeticsResolver,undefined,
 source?undefined:loadTwitchSourcePortrait,undefined,source?undefined:fetchTwitchUserAvatar);
 const dispose=()=>{if(disposed)return;disposed=true;mixer.close();};
 if(!supportsBrowserPublicChat(selection.platform)){
  onStatus?.({platform:selection.platform,channel:selection.channel,state:'error',emotes:'idle',badges:'idle',error:'This provider requires a local relay'});
  return {dispose};
 }
 try{mixer.addSource(selection.channel,selection.platform);}
 catch(error){
  onStatus?.({platform:selection.platform,channel:selection.channel,state:'error',emotes:'degraded',badges:'idle',error:error instanceof Error?error.message:'Browser connection failed'});
 }
 return {dispose};
}
export function connectPreferredSource(capability:PreferredLiveCapability,selection:ViewerSource,onEvent:(event:OverlayLiveEvent)=>void,onStatus?: (status:WireLiveStatus)=>void,onSignal?:(signal:SocialSignalV1)=>void){
 return capability.mode==='browser'
  ?connectBrowserLiveSource(onEvent,onStatus,onSignal,selection)
  :connectLiveSource(onEvent,onStatus,onSignal,{endpoint:capability.websocketPath,platform:selection.platform,channel:selection.channel});
}
