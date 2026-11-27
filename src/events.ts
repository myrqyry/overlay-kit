import type {SocialSignalV1} from '@myrqyry/chatbus';
import {
  ALERT_KINDS, parseEventOverrides, resolveEventVisual, EVENT_VISUAL_DEFAULT,
  type AlertKind, type EventAccent, type EventFamily, type EventStyle,
  type EventEntrance, type EventExit, type EventOverride, type EventVisualSettings,
} from './event-overrides';

export type {AlertKind};
export interface EventAlert {key:string|null;kind:AlertKind;title:string;message:string;tier?:string}
export interface EventOptions {
  durationMs?:number;
  maxQueued?:number;
  now?:()=>number;
  enabled?:Readonly<Partial<Record<AlertKind,boolean>>>;
  /** The overlay delays queue advancement until exit animation completes. */
  deferAdvanceOnReceive?:boolean;
}
const kinds=new Set<AlertKind>(ALERT_KINDS);
const titleByKind:Record<AlertKind,string>={
  subscription:'New subscriber', 'gift-subscription':'Gift subscriptions',
  raid:'Incoming raid',follow:'New follower',cheer:'Bits cheer',
  donation:'Donation', 'reward-redemption':'Channel reward',
};
const clean=(value:unknown,max:number):string=>
  typeof value==='string' ? value.trim().slice(0,max) : '';
const validCount=(value:unknown):number|null=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0 ? value:null;

/** Use only source-supplied social evidence; do not infer tier, tenure or gift amounts. */
export function formatSocialAlert(signal:SocialSignalV1):EventAlert|null {
  if(!signal||typeof signal!=='object'||signal.schemaVersion!==1||signal.producer!=='chatbus'
    ||!signal.source||typeof signal.source.platform!=='string'||!signal.event)return null;
  const kind=signal.event.type as AlertKind;
  if(!kinds.has(kind))return null;
  const viewer=clean(signal.actor?.displayName||signal.actor?.username,48);
  const count=validCount(signal.measurements?.count);
  const bits=validCount(signal.measurements?.bits);
  const who=viewer || 'Someone';
  const tiktokGift=kind==='donation'&&signal.source.platform==='tiktok'&&signal.source.upstream==='tiktok-live';
  const message=tiktokGift ? (count!==null?who+' sent '+count+' gift'+(count===1?'':'s')+' on TikTok!':who+' sent a gift on TikTok!')
    : kind==='subscription' ? (viewer?who+' subscribed!':'New subscription!')
    : kind==='gift-subscription' ? (count!==null?who+' gifted '+count+' subscriptions!':who+' gifted a subscription!')
    : kind==='raid' ? (count!==null?who+' raided with '+count+' viewers!':who+' raided the channel!')
    : kind==='follow' ? (viewer?who+' followed the channel!':'A viewer followed the channel!')
    : kind==='cheer' ? (bits!==null?who+' cheered '+bits+' bits!':who+' cheered!')
    : kind==='donation' ? (clean(signal.measurements?.amount,32) && clean(signal.measurements?.currency,12)
      ? who+' donated '+clean(signal.measurements?.amount,32)+' '+clean(signal.measurements?.currency,12)+'!'
      : who+' sent a donation!')
    : who+' redeemed a channel reward!';
  const source=signal.source;
  const id=clean(signal.event.id,120);
  const key=id?JSON.stringify([source.platform,source.channelId??source.channelName??'',id]):null;
  const tier=clean(signal.event.tier,32);
  return {key,kind,title:tiktokGift?'TikTok gift':titleByKind[kind],message,...(tier?{tier}:{})};
}

/** Pure admission + expiration. The view owns timers, not the queue. */
export function createEventQueue(options:EventOptions={}) {
  const clock=options.now??Date.now;
  let duration=Math.min(30000,Math.max(250,options.durationMs??6000));
  let maxQueued=Math.min(24,Math.max(1,options.maxQueued??8));
  let enabled=options.enabled;
  const seen=new Map<string,number>();
  const pending:EventAlert[]=[];
  let active:EventAlert|null=null,deadline=0,disposed=false;
  function advance() {
    if(disposed)return;
    const time=clock();
    if(active && time<deadline)return;
    active=pending.shift()??null;
    deadline=active?time+duration:0;
  }
  function receive(signal:SocialSignalV1) {
    if(disposed)return false;
    const alert=formatSocialAlert(signal);
    if(!alert||enabled?.[alert.kind]===false)return false;
    if(alert.key&&seen.has(alert.key))return false;
    if(alert.key){
      seen.set(alert.key,clock());
      while(seen.size>256)seen.delete(seen.keys().next().value!);
    }
    if(!options.deferAdvanceOnReceive && active&&clock()>=deadline)advance();
    if(!active){active=alert;deadline=clock()+duration;}
    else {
      if(pending.length>=maxQueued)pending.shift();
      pending.push(alert);
    }
    return true;
  }
  return {
    receive,advance,
    snapshot:()=>active,
    deadline:()=>deadline,
    pending:()=>pending.length,
    configure(patch:EventOptions){
      if(patch.durationMs!==undefined){duration=Math.min(30000,Math.max(250,patch.durationMs));if(active)deadline=clock()+duration;}
      if(patch.maxQueued!==undefined){maxQueued=Math.min(24,Math.max(1,patch.maxQueued));while(pending.length>maxQueued)pending.shift();}
      if(patch.enabled!==undefined)enabled=patch.enabled;
    },
    clear(){active=null;deadline=0;pending.length=0;seen.clear();},
    dispose(){disposed=true;active=null;deadline=0;pending.length=0;seen.clear();},
  };
}
export interface EventOverlayOptions extends EventOptions {
  fontSize?:number;
  position?:'top'|'center'|'bottom';
  style?:EventStyle;
  accent?:EventAccent;
  fontFamily?:EventFamily;
  motion?:EventEntrance;
  motionMs?:number;
  exit?:EventExit;
  exitMs?:number;
  /** Serialized or parsed type/tier rules layered over the base settings. */
  overrides?:string|readonly EventOverride[];
}
export function createEventOverlay(root:HTMLElement,options:EventOverlayOptions={}) {
  const queue=createEventQueue({...options,deferAdvanceOnReceive:true});
  const clock=options.now??Date.now;
  const surface=document.createElement('div');
  surface.className='overlay-events';
  let position=options.position??'center';
  const clampMs=(value:number|undefined,fallback:number)=>Math.min(1500,Math.max(100,value??fallback));
  let base:EventVisualSettings={
    style:options.style??EVENT_VISUAL_DEFAULT.style,
    accent:options.accent??EVENT_VISUAL_DEFAULT.accent,
    fontFamily:options.fontFamily??EVENT_VISUAL_DEFAULT.fontFamily,
    motion:options.motion??EVENT_VISUAL_DEFAULT.motion,
    motionMs:clampMs(options.motionMs,EVENT_VISUAL_DEFAULT.motionMs),
    exit:options.exit??EVENT_VISUAL_DEFAULT.exit,
    exitMs:clampMs(options.exitMs,EVENT_VISUAL_DEFAULT.exitMs),
    fontSize:Math.min(80,Math.max(16,options.fontSize??EVENT_VISUAL_DEFAULT.fontSize)),
  };
  let overrides=parseEventOverrides(options.overrides??'');
  const applyVisual=(visual:EventVisualSettings)=>{
    surface.dataset.position=position;
    surface.dataset.style=visual.style;
    surface.dataset.accent=visual.accent;
    surface.dataset.family=visual.fontFamily;
    surface.dataset.motion=visual.motion;
    surface.dataset.exit=visual.exit;
    surface.style.setProperty('--event-enter-duration',visual.motionMs+'ms');
    surface.style.setProperty('--event-exit-duration',visual.exitMs+'ms');
    surface.style.setProperty('--events-font',visual.fontSize+'px');
  };
  const visualFor=(alert:EventAlert|null):EventVisualSettings=>alert
    ? resolveEventVisual(base,overrides,alert.kind,alert.tier) : base;
  applyVisual(base);
  root.append(surface);
  let timer:ReturnType<typeof setTimeout>|null=null;
  let exitTimer:ReturnType<typeof setTimeout>|null=null;
  let exitCard:HTMLElement|null=null;
  let disposed=false;
  let shown:EventAlert|null=null;
  const cancelTimers=()=>{
    if(timer!==null){clearTimeout(timer);timer=null;}
    if(exitTimer!==null){clearTimeout(exitTimer);exitTimer=null;}
    if(exitCard){exitCard.removeEventListener('animationend',onExitAnimation);exitCard=null;}
  };
  const onExitAnimation=(event:Event)=>{
    if(event.target!==exitCard || !(event as AnimationEvent).animationName.startsWith('event-out-'))return;
    finishExit();
  };
  function finishExit(){
    if(!exitCard||disposed)return;
    cancelTimers();
    queue.advance();
    render();
  }
  function startExit(){
    const current=queue.snapshot();
    if(disposed||exitCard||!current)return;
    const visual=visualFor(current);
    applyVisual(visual);
    if(visual.exit==='none' || surface.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      queue.advance();render();return;
    }
    const card=surface.querySelector<HTMLElement>('.overlay-event-alert');
    if(!card){queue.advance();render();return;}
    exitCard=card;
    card.dataset.phase='exiting';
    card.addEventListener('animationend',onExitAnimation);
    exitTimer=setTimeout(finishExit,visual.exitMs);
  }
  function render() {
    if(disposed||exitCard)return;
    const current=queue.snapshot();
    if(current!==shown){
      shown=current;
      applyVisual(visualFor(current));
      surface.replaceChildren();
      if(current){
        const card=document.createElement('section');
        card.className='overlay-event-alert';
        card.dataset.eventType=current.kind;
        const heading=document.createElement('div');
        heading.className='overlay-event-heading';
        heading.textContent=current.title;
        const text=document.createElement('div');
        text.className='overlay-event-message';
        text.textContent=current.message;
        card.append(heading,text);
        surface.append(card);
      }
    }
    if(timer!==null){clearTimeout(timer);timer=null;}
    if(current)timer=setTimeout(()=>{timer=null;startExit();},Math.max(0,queue.deadline()-clock()));
  }
  return {
    receive(signal:SocialSignalV1){
      if(disposed)return;
      if(queue.snapshot() && clock()>=queue.deadline())startExit();
      if(queue.receive(signal))render();
    },
    configure(patch:EventOverlayOptions){
      queue.configure(patch);
      if(patch.position!==undefined)position=patch.position;
      if(patch.overrides!==undefined)overrides=parseEventOverrides(patch.overrides);
      const next={...base};
      if(patch.style!==undefined)next.style=patch.style;
      if(patch.accent!==undefined)next.accent=patch.accent;
      if(patch.fontFamily!==undefined)next.fontFamily=patch.fontFamily;
      if(patch.motion!==undefined)next.motion=patch.motion;
      if(patch.motionMs!==undefined)next.motionMs=clampMs(patch.motionMs,EVENT_VISUAL_DEFAULT.motionMs);
      if(patch.exit!==undefined)next.exit=patch.exit;
      if(patch.exitMs!==undefined)next.exitMs=clampMs(patch.exitMs,EVENT_VISUAL_DEFAULT.exitMs);
      if(patch.fontSize!==undefined)next.fontSize=Math.min(80,Math.max(16,patch.fontSize));
      base=next;
      applyVisual(visualFor(queue.snapshot()));
      render();
    },
    clear(){cancelTimers();queue.clear();shown=null;surface.replaceChildren();},
    snapshot:queue.snapshot,
    dispose(){if(disposed)return;disposed=true;cancelTimers();queue.dispose();surface.remove();},
  };
}
