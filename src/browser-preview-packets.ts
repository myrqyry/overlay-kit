import type {SocialSignalV1} from '@myrqyry/chatbus';
import type {OverlayLiveEvent} from './live';
import type {WireLiveStatus} from './live-client';
import type {ViewerSource} from './channel-choice';
import {sourceKey} from './source-subscriptions';
export type BrowserPreviewPacket={type:'event';value:OverlayLiveEvent}|{type:'status';value:WireLiveStatus}|{type:'signal';value:SocialSignalV1};
/** All hosted and direct connections share the owning editor's normalized
 * packets with previews. Standalone sources stay independent. No credentials. */
export function createParentPreviewPackets(parent:Window,origin:string){
 const receivers=new Map<string,(packet:BrowserPreviewPacket)=>void>();
 return {
  open(source:ViewerSource,receive:(packet:BrowserPreviewPacket)=>void){
   const key=sourceKey(source);receivers.set(key,receive);
   return {dispose(){if(receivers.get(key)===receive)receivers.delete(key);}};
  },
  receive(event:MessageEvent){
   if(event.source!==parent||event.origin!==origin||event.data?.type!=='overlay-kit-preview-live-packet')return;
   const {source,packet}=event.data;
   if(!source||!['twitch','kick','youtube','tiktok'].includes(source.platform)||typeof source.channel!=='string'||!packet?.value||!['event','status','signal'].includes(packet.type))return;
   receivers.get(sourceKey(source))?.(packet);
  },
 };
}
