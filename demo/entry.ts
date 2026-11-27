import {watchBrowserYouTubeKey} from '../src/youtube-browser-key';
import {createParentPreviewPackets} from '../src/browser-preview-packets';
import {getPreferredLiveCapability,connectPreferredSource} from '../src/browser-live-client';
import { createOverlayBridge } from '../src/bridge';
import { createEmoteChorusDetector } from '../src/emote-chorus';
import type { OverlayLiveEvent } from '../src/live';
import {createSourceSubscriptions,sourceKey} from '../src/source-subscriptions';
import { applyLiveEvent, connectLiveSource, type WireLiveStatus } from '../src/live-client';
import {normalizeViewerChannel,normalizeViewerPlatform,readViewerSources,type ViewerSource} from '../src/channel-choice';
import { createChatFeed, createEmoteWall } from '../src/views';
import { createAvatarScene } from '../src/avatar-scene';
import { createEventOverlay } from '../src/events';
import { createUserAdmissionFilter } from '../src/admission';
import { createPreviewLiveGate } from '../src/preview-live';
import { sampleSocialSignal } from './sample-events';
import { normalizeOptions, readOptions, type OverlayOptions } from '../src/options';
import { sampleMessage } from './sample';
import {createPreviewAssetLibrary} from '../src/preview-asset-cache';
import {createTriggerDirector,parseTriggerRules,type TriggerEffect} from '../src/overlay-triggers';
import {createTriggerPresentation} from '../src/trigger-presentation';
import './styles.css';
import { localKickArtwork } from './local-kick-artwork';

const root = document.getElementById('overlay-root');
if (!root) throw new Error('Overlay root is missing');

let options = readOptions(location.search, document.body.dataset.view === 'wall' ? 'wall' : document.body.dataset.view === 'avatars' ? 'avatars' : document.body.dataset.view === 'events' ? 'events' : 'chat');
const preview = new URLSearchParams(location.search).get('preview') === '1';
const liveEnabled = new URLSearchParams(location.search).get('live') !== '0';
const view = document.body.dataset.view;
let admission=createUserAdmissionFilter(view==='wall'?options.wallIgnoredUsers
  :view==='avatars'?options.avatarIgnoredUsers:view==='chat'?options.chatIgnoredUsers:'');
const chatSettings=(value:OverlayOptions)=>({
  kickRoleArtwork:localKickArtwork,
  maxActive:value.max,ttlMs:value.ttl*1000,fontSize:value.font,usernameSize:value.usernameSize,textColorSource:value.textColorSource,emoteSize:value.size,
  googleFont:value.googleFont,showBadges:value.showBadges,emojiService:value.chatEmojiService,
  showPlatformBadges:value.showPlatformBadges,showSourceBadges:value.showSourceBadges,
  showViewerBadges:value.showViewerBadges,showRoleBadges:value.showRoleBadges,
  showSubscriberBadges:value.showSubscriberBadges,showGifterBadges:value.showGifterBadges,
  showCosmeticBadges:value.showCosmeticBadges,
  showNames:value.showNames,showTimestamp:value.showTimestamp,linkDisplay:value.linkDisplay,fontFamily:value.fontFamily,
  stroke:value.stroke,shadow:value.shadow,lineHeight:value.lineHeight,backgroundAlpha:value.backgroundAlpha,
  messageBackground:value.messageBackground,messagePaintBlur:value.messagePaintBlur,messageOutline:value.messageOutline,radius:value.radius,edgeFade:value.edgeFade,
  edgeFadeStyle:value.edgeFadeStyle,edgeFadeUnit:value.edgeFadeUnit,edgeFadePixels:value.edgeFadePixels,
  edgeFadeOpacity:value.edgeFadeOpacity,edgeFadeHold:value.edgeFadeHold,edgeFadeSteps:value.edgeFadeSteps,edgeFadePattern:value.edgeFadePattern,edgeFadePatternSize:value.edgeFadePatternSize,
  align:value.align,textAlign:value.textAlign,vertical:value.vertical,layout:value.chatLayout,nameplateStyle:value.nameplateStyle,newLineAfterUsername:value.newLineAfterUsername,stripRows:value.stripRows,
  repeatMode:value.repeatMode,repeatMatch:value.repeatMatch,repeatScope:value.repeatScope,repeatWindowMs:value.repeatWindow*1000,repeatShowCount:value.repeatShowCount,
  stylePack:value.chatStyle,spacing:value.spacing,padding:value.padding,maxMessageWidth:value.maxMessageWidth,uniformMessageWidth:value.uniformMessageWidth,
  enter:value.enter,exit:value.exit,enterMs:value.enterMs,exitMs:value.exitMs,
  deleteEffect:value.deleteEffect,deleteMs:value.deleteMs,
  letterEnter:value.letterEnter,letterEnterMs:value.letterEnterMs,letterExit:value.letterExit,
  smoothReflow:value.smoothReflow,reflowMs:value.reflowMs,
});
const wallSettings=(value:OverlayOptions)=>({
  maxActive:value.wallMax,ttlMs:value.wallTtl*1000,size:value.wallSize,motion:value.motion,
  wallSpeed:value.wallSpeed,wallDistance:value.wallDistance,spawn:value.spawn,
  emojiService:value.wallEmojiService,wallGifs:value.wallGifs,wallEnter:value.wallEnter,wallExit:value.wallExit,
  wallEnterMs:value.wallEnterMs,wallExitMs:value.wallExitMs,wallField:value.wallField,
  wallStyle:value.wallStyle,wallColor:value.wallColor,wallFinish:value.wallFinish,
});
const avatarSettings=(value:OverlayOptions)=>({
  maxActive:value.avatarsMax,size:value.avatarSize,activity:value.avatarActivity,showNames:value.avatarNames,
});
const eventSettings=(value:OverlayOptions)=>({
  durationMs:value.eventDuration*1000,fontSize:value.eventFont,position:value.eventPosition,
  style:value.eventStyle,accent:value.eventAccent,fontFamily:value.eventFamily,
  motion:value.eventMotion,motionMs:value.eventMotionMs,exit:value.eventExit,exitMs:value.eventExitMs,
  overrides:value.eventOverrides,
  enabled:{subscription:value.eventSubs,'gift-subscription':value.eventSubs,follow:value.eventFollows,
    raid:value.eventRaids,cheer:value.eventCheers,donation:value.eventCheers},
});
const eventOverlay = view==='events' ? createEventOverlay(root,eventSettings(options)) : null;
const chatFeed = view==='chat' ? createChatFeed(root,chatSettings(options)) : null;
const wallFeed = view==='wall' ? createEmoteWall(root,wallSettings(options)) : null;
const avatarScene = view==='avatars' ? createAvatarScene(root,avatarSettings(options)) : null;
const consumer = chatFeed ?? wallFeed ?? avatarScene;
// Rule effects borrow existing style-pack lifecycles and restore the latest
// user-selected baseline, even if inspector settings change while active.
const triggerView=view==='chat'||view==='wall'?view:null;
const applyTriggerStyle=(effect:TriggerEffect|null)=>{
  if(chatFeed)chatFeed.configure({
    stylePack:effect==='paper'||effect==='phosphor'?effect:options.chatStyle,
  });
  if(wallFeed)wallFeed.configure({
    wallStyle:effect==='holo-foil'||effect==='ink-wash'?effect:options.wallStyle,
    motion:effect==='bounce'?'bounce':options.motion,
  });
};
const triggerPresentation=triggerView
  ?createTriggerPresentation(root,{onVisual:applyTriggerStyle}):null;
const triggerDirector=triggerView
  ?createTriggerDirector(triggerView,
    triggerView==='chat'?options.chatTriggerRules:options.wallTriggerRules,
    {onChange:cue=>triggerPresentation?.show(cue)}):null;

let chorus = view === 'wall' && options.wallChorus ? createEmoteChorusDetector() : null;
const receiveEvent = (event: OverlayLiveEvent) => {
  if(!admission.accept(event))return;
  if(event.type==='message')triggerDirector?.receiveMessage(event.message);
  const cue=chorus?.observe(event);
  if(consumer)applyLiveEvent(consumer,event);
  if(consumer && cue && 'reactToChant' in consumer) consumer.reactToChant(cue.message,cue.art);
};
const bridge = view==='events' ? null : createOverlayBridge('myrqyry-overlay-kit-v1', event => {
  receiveEvent({type:'message',message:event.message});
});
const liveFeeds:{dispose():void}[]=[];
const connectedSources=new Set<string>();
const seedPreview=()=>{
  if(!preview)return;
  if(eventOverlay)eventOverlay.receive(sampleSocialSignal(0));
  else {
    const cached=createPreviewAssetLibrary().profiles();
    for(let i=0;i<3;i++)receiveEvent({type:'message',message:sampleMessage(i,cached)});
  }
};
const previewGate=createPreviewLiveGate({
  preview,
  onEnter:()=>{chorus?.reset();triggerDirector?.clear();consumer?.clear();eventOverlay?.clear();},
  onLeave:()=>{chorus?.reset();triggerDirector?.clear();consumer?.clear();eventOverlay?.clear();seedPreview();},
});
const receiveLiveEvent=(event:OverlayLiveEvent)=>{
  previewGate.contentArrived();
  receiveEvent(event);
};
const receiveLiveSignal=(signal:Parameters<NonNullable<typeof eventOverlay>['receive']>[0])=>{
  previewGate.contentArrived();
  eventOverlay?.receive(signal);
  triggerDirector?.receiveSignal(signal);
};
let hostedFeeds:ReturnType<typeof createSourceSubscriptions<HostedPacket>>|null=null;
type HostedPacket={type:'event';value:OverlayLiveEvent}|{type:'status';value:WireLiveStatus}|{type:'signal';value:Parameters<NonNullable<typeof eventOverlay>['receive']>[0]};
let pendingSources:ViewerSource[]|null=null;
let activeViewerSources:ViewerSource[]=[];
let directBrowserMode=false;
const parentPackets=createParentPreviewPackets(window.parent,location.origin);
const onParentPacket=(event:MessageEvent)=>{if(preview&&window.parent!==window)parentPackets.receive(event);};
window.addEventListener('message',onParentPacket);
const stopWatchingYouTubeKey=watchBrowserYouTubeKey(()=>{
  if(!directBrowserMode||(preview&&window.parent!==window))return;
  for(const source of activeViewerSources.filter(item=>item.platform==='youtube'))hostedFeeds?.reconnect(source);
});
const onPreviewSources=(event:MessageEvent)=>{
  if(!preview||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='overlay-kit-preview-sources'||!Array.isArray(event.data.sources))return;
  const sources:ViewerSource[]=event.data.sources.flatMap((item:unknown)=>{
    if(!item||typeof item!=='object')return [];
    const value=item as Partial<ViewerSource>;
    const platform=normalizeViewerPlatform(value.platform);
    const channel=platform?normalizeViewerChannel(value.channel,platform):null;
    return platform&&channel?[{platform,channel}]:[];
  });
  pendingSources=sources;
  hostedFeeds?.sync(sources);
  const target=event.data.reconnect as ViewerSource|undefined;
  if(target&&sources.some(source=>sourceKey(source)===sourceKey(target)))hostedFeeds?.reconnect(target);
};
window.addEventListener('message',onPreviewSources);
if(liveEnabled||(preview&&window.parent!==window)) void getPreferredLiveCapability().then(capability => {
  if(!capability)return;
  const params=new URLSearchParams(location.search);
  if(capability.mode==='hosted'||capability.mode==='browser'){
    directBrowserMode=capability.mode==='browser';
    let sources=liveEnabled?readViewerSources(params):[];
    if(liveEnabled&&!sources.length&&!params.has('source')&&!params.has('channel')){
      const platform=normalizeViewerPlatform(params.get('platform'))??capability.platform;
      const channel=normalizeViewerChannel(params.get('channel')??capability.channel,platform);
      if(channel)sources=[{platform,channel}];
    }
    const allowed=(items:readonly ViewerSource[])=>items.filter(source=>capability.platforms.includes(source.platform));
    const sessions=createSourceSubscriptions<HostedPacket>((source,receive)=>{
      if(directBrowserMode&&preview&&window.parent!==window&&source.platform==='youtube')return parentPackets.open(source,receive);
      return connectPreferredSource(capability,source,
      value=>receive({type:'event',value}),value=>receive({type:'status',value}),value=>receive({type:'signal',value}),
    );},(source,packet)=>{
      const key=sourceKey(source);
      if(packet.type==='event')receiveLiveEvent(packet.value);
      else if(packet.type==='signal')receiveLiveSignal(packet.value);
      else{
        if(packet.value.state==='connected')connectedSources.add(key);
        else connectedSources.delete(key);
        previewGate.connectivityChanged(connectedSources.size>0);
      }
    },source=>{
      const key=sourceKey(source);connectedSources.delete(key);
      consumer?.removeSource?.(key);
      previewGate.connectivityChanged(connectedSources.size>0);
    });
    hostedFeeds={
      sync:items=>{activeViewerSources=allowed(items);sessions.sync(activeViewerSources);},
      reconnect:source=>sessions.reconnect(source),dispose:()=>sessions.dispose(),
    };
    hostedFeeds.sync(pendingSources??sources);
    return;
  }
  if(!liveEnabled)return;
  liveFeeds.push(connectLiveSource(receiveLiveEvent,status=>{
    const sources=status.sources??[];
    const shouldLive=sources.length
      ? sources.some(source=>source.state==='connected')
      : status.state==='connected';
    previewGate.connectivityChanged(shouldLive);
  },receiveLiveSignal,{endpoint:capability.websocketPath}));
});
// A source page is empty until actual input arrives. Only the studio iframes
// request synthetic preview fixtures; ordinary OBS pages display real events only.
if(preview && liveEnabled)seedPreview();
const onPreviewSettings=(event:MessageEvent)=>{
  if(!preview || event.source!==window.parent || event.origin!==location.origin)return;
  if(!event.data || event.data.type!=='overlay-kit-preview-settings')return;
  const next=normalizeOptions(event.data.settings);
  const previous=options;
  options=next;
  admission=createUserAdmissionFilter(view==='wall'?next.wallIgnoredUsers
    :view==='avatars'?next.avatarIgnoredUsers:view==='chat'?next.chatIgnoredUsers:'');
  if(chatFeed){
    chatFeed.configure(chatSettings(next));
    chatFeed.refreshAppearance();
  } else if(wallFeed){
    wallFeed.configure(wallSettings(next));
    if(next.wallChorus && !chorus)chorus=createEmoteChorusDetector();
    else if(!next.wallChorus && chorus){chorus.reset();chorus=null;}
  } else if(avatarScene)avatarScene.configure(avatarSettings(next));
  else eventOverlay?.configure(eventSettings(next));
  if(triggerView){
    const key=triggerView==='chat'?'chatTriggerRules':'wallTriggerRules';
    if(next[key]!==previous[key])triggerDirector?.configure(next[key]);
    else applyTriggerStyle(triggerDirector?.active()?.effect??null);
  }
};
window.addEventListener('message',onPreviewSettings);
// A cache-clear action refreshes only synthetic fixtures. It cannot erase
// genuine live messages or alter ordinary OBS browser sources.
const onPreviewAssetsReset=(event:MessageEvent)=>{
  if(!preview||event.source!==window.parent||event.origin!==location.origin||
    event.data?.type!=='overlay-kit-preview-assets-reset'||previewGate.isLive()||!consumer)return;
  consumer.clear();chorus?.reset();seedPreview();
};
window.addEventListener('message',onPreviewAssetsReset);
// Synthetic button events are accepted only by preview iframes, never ordinary OBS sources.
const onPreviewSignal=(event:MessageEvent)=>{
  if(!preview || !eventOverlay || event.source!==window.parent || event.origin!==location.origin)return;
  if(!event.data || event.data.type!=='overlay-kit-event-preview')return;
  const signal:unknown=event.data.signal;
  if(!signal || typeof signal!=='object')return;
  const value=signal as ReturnType<typeof sampleSocialSignal>;
  if(value.source?.origin!=='test')return;
  eventOverlay.receive(value);
};
window.addEventListener('message',onPreviewSignal);
// Explicitly synthetic manual trigger tests are accepted only from the owning
// same-origin control-room iframe, never from outside websites or live chat.
let syntheticTriggerId=0;
const onPreviewTrigger=(event:MessageEvent)=>{
  if(!preview||!triggerDirector||event.source!==window.parent||event.origin!==location.origin||
    event.data?.type!=='overlay-kit-trigger-preview')return;
  const type=event.data.kind,key=event.data.key;
  if((type!=='command'&&type!=='event')||typeof key!=='string')return;
  const configured=parseTriggerRules(triggerView==='chat'?options.chatTriggerRules:options.wallTriggerRules,
    triggerView==='chat'?'chat':'wall').rules;
  if(!configured.some(rule=>rule.kind===type&&rule.key===key))return;
  const id='synthetic-trigger-'+(++syntheticTriggerId);
  if(type==='command'){
    triggerDirector.receiveMessage({
      id,timestamp:Date.now(),sourceId:'preview:trigger',
      user:{name:'Preview moderator',username:'preview_mod',roles:['moderator'],badges:[]},
      parts:[{type:'text',text:key}],
    });
    return;
  }
  const sample=sampleSocialSignal(syntheticTriggerId);
  triggerDirector.receiveSignal({...sample,
    event:{...sample.event,id,type:key as typeof sample.event.type},
    source:{...sample.source,origin:'test'}});
};
window.addEventListener('message',onPreviewTrigger);
window.addEventListener('pagehide', () => {
  stopWatchingYouTubeKey();window.removeEventListener('message',onParentPacket);
  hostedFeeds?.dispose();window.removeEventListener('message',onPreviewSources);
  for(const feed of liveFeeds)feed.dispose(); bridge?.dispose();
  triggerDirector?.dispose();triggerPresentation?.dispose();
  consumer?.dispose(); eventOverlay?.dispose();
  window.removeEventListener('message',onPreviewSignal);
  window.removeEventListener('message',onPreviewTrigger);
  window.removeEventListener('message',onPreviewSettings);
  window.removeEventListener('message',onPreviewAssetsReset);
}, { once: true });
