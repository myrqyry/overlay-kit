import {describe,it,expect,vi} from 'vitest';
import type {SocialSignalV1} from '@myrqyry/chatbus';
import {createEventQueue,createEventOverlay,formatSocialAlert} from '../src/events';
import {readOptions,normalizeOptions,writeOptions,optionsForEditor,isOptionApplicable,DEFAULT_OPTIONS} from '../src/options';import {restoreSeparateSettings} from '../src/editor-settings';
import {readFileSync} from 'node:fs';

function signal(type:SocialSignalV1['event']['type'],id='evt-1',name='Mossy',metrics:SocialSignalV1['measurements']={}):SocialSignalV1 {
  return {schemaVersion:1,producer:'chatbus',source:{platform:'twitch',channelName:'garden',origin:'live'},
    event:{type,id,occurredAtMs:1000,receivedAtMs:1000},
    actor:{platform:'twitch',username:name.toLowerCase(),displayName:name},
    measurements:metrics};
}
describe('Chatbus social event alerts',()=>{
  it('formats only real eligible signals without inventing months, tiers, or viewer names',()=>{
    expect(formatSocialAlert(signal('subscription'))).toMatchObject({kind:'subscription',title:'New subscriber',message:'Mossy subscribed!'});
    expect(formatSocialAlert(signal('gift-subscription','gift','Fern',{count:5}))?.message).toContain('5');
    expect(formatSocialAlert(signal('raid','raid','Fox',{count:42}))?.message).toContain('42');
    expect(formatSocialAlert(signal('cheer','bits','Pixel',{bits:100}))?.message).toContain('100');
    expect(formatSocialAlert(signal('follow'))?.title).toBe('New follower');
    expect(formatSocialAlert({...signal('subscription'),actor:undefined})?.message).not.toContain('Mossy');
    expect(formatSocialAlert(signal('message'))).toBeNull();
    expect(formatSocialAlert(signal('system'))).toBeNull();
    expect(formatSocialAlert({schemaVersion:1,producer:'chatbus',event:{type:'raid',id:'x'}} as SocialSignalV1)).toBeNull();
    expect(formatSocialAlert({...signal('raid'),producer:'untrusted' as 'chatbus'})).toBeNull();
  });
  it('honors disabled event triggers without displaying hidden events',()=>{
    const queue=createEventQueue({enabled:{follow:false,raid:false,'gift-subscription':false}});
    expect(queue.receive(signal('follow'))).toBe(false);
    expect(queue.receive(signal('raid','r1'))).toBe(false);
    expect(queue.receive(signal('gift-subscription','g1'))).toBe(false);
    expect(queue.snapshot()).toBeNull();
    expect(queue.receive(signal('subscription','s1'))).toBe(true);
    expect(queue.snapshot()?.kind).toBe('subscription');
    queue.dispose();
  });
  it('queues bursts, deduplicates source IDs, and expires items with an injected clock',()=>{
    let now=1000;
    const queue=createEventQueue({durationMs:2000,now:()=>now,maxQueued:2});
    queue.receive(signal('subscription','s1'));
    queue.receive(signal('subscription','s1'));
    queue.receive(signal('raid','r1','Fox'));
    queue.receive(signal('follow','f1','Fern'));
    queue.receive(signal('cheer','c1','Zed'));
    expect(queue.snapshot()?.kind).toBe('subscription');
    expect(queue.pending()).toBe(2);
    now+=2001;
    queue.advance();
    expect(queue.snapshot()?.kind).toBe('follow');
    now+=2001;
    queue.advance();
    expect(queue.snapshot()?.kind).toBe('cheer');
    now+=2001;
    queue.advance();
    expect(queue.snapshot()).toBeNull();
    queue.dispose();
    expect(queue.pending()).toBe(0);
  });
  it('renders untrusted actor text as text, runs one bounded lifecycle, and cleans up',()=>{
    vi.useFakeTimers();
    try{
      const root=document.createElement('div');
      const overlay=createEventOverlay(root,{durationMs:1000,fontSize:36,position:'center'});
      overlay.receive(signal('subscription','x1','<img src=x onerror=alert(1)>'));
      expect(root.querySelector('img')).toBeNull();
      expect(root.textContent).toContain('<img');
      overlay.receive(signal('raid','x2','Fox',{count:3}));
      vi.advanceTimersByTime(1000);
      expect(root.querySelector('.overlay-event-alert')?.getAttribute('data-phase')).toBe('exiting');
      vi.advanceTimersByTime(300);
      expect(root.textContent).toContain('Fox');
      vi.advanceTimersByTime(1300);
      expect(root.textContent).not.toContain('Fox');
      overlay.dispose();
      expect(root.childElementCount).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    }finally{vi.useRealTimers();}
  });
});
describe('Events workspace contract',()=>{
 it('exposes independent URL settings, saved state and a dedicated source',()=>{
   const settings=normalizeOptions({eventDuration:12,eventFont:42,eventPosition:'top',eventFollows:false});
   const url=writeOptions(settings,'events');
   expect(url).toContain('eventDuration=12');
   expect(url).not.toContain('avatarsMax=');
   expect(readOptions('?'+url,'events').eventDuration).toBe(12);
   expect(readOptions('?'+url,'events').eventFollows).toBe(false);
   expect(optionsForEditor('events',true).some(def=>def.key==='eventFont')).toBe(true);
   const restored=restoreSeparateSettings(null,{chat:{font:35},events:{eventDuration:9}},'');
   expect(restored.chat.font).toBe(35);
   expect(restored.events.eventDuration).toBe(9);
   const doc=new DOMParser().parseFromString(readFileSync('index.html','utf8'),'text/html');
   expect(Array.from(doc.querySelectorAll('.workspace-tabs [role=tab]')).map(x=>x.id)).toEqual(['edit-wall','edit-chat','edit-avatars','edit-events']);
   expect(doc.querySelector('#events-preview')).not.toBeNull();
   expect(readFileSync('events.html','utf8')).toContain('data-view="events"');
 });
});

describe('event exit lifecycle',()=>{
 it('expires the final alert with an exit phase even without a successor, then empties',()=>{
  vi.useFakeTimers();
  try{
   const root=document.createElement('div');
   const overlay=createEventOverlay(root,{durationMs:1000,exit:'fade',exitMs:300});
   overlay.receive(signal('subscription','last'));
   vi.advanceTimersByTime(1000);
   expect(root.querySelector('.overlay-event-alert')?.getAttribute('data-phase')).toBe('exiting');
   vi.advanceTimersByTime(299);
   expect(root.querySelector('.overlay-event-alert')).not.toBeNull();
   vi.advanceTimersByTime(1);
   expect(root.querySelector('.overlay-event-alert')).toBeNull();
   expect(overlay.snapshot()).toBeNull();
   overlay.dispose();
   expect(vi.getTimerCount()).toBe(0);
  }finally{vi.useRealTimers();}
 });
 it('queues an arrival during exit and clears/disposes immediately',()=>{
  vi.useFakeTimers();
  try{
   const root=document.createElement('div');
   const overlay=createEventOverlay(root,{durationMs:1000,exit:'sink',exitMs:300});
   overlay.receive(signal('subscription','one'));
   vi.advanceTimersByTime(1000);
   overlay.receive(signal('raid','two','Fox'));
   expect(root.textContent).not.toContain('Fox');
   vi.advanceTimersByTime(300);
   expect(root.textContent).toContain('Fox');
   overlay.clear();
   expect(root.querySelector('.overlay-event-alert')).toBeNull();
   expect(vi.getTimerCount()).toBe(0);
   overlay.receive(signal('subscription','three'));
   overlay.dispose();
   expect(root.childElementCount).toBe(0);
   expect(vi.getTimerCount()).toBe(0);
  }finally{vi.useRealTimers();}
 });
});

describe('Events animation and styling parity',()=>{
 const css=readFileSync('src/events.css','utf8');
 it('round-trips accent, typeface and entrance duration without changing defaults',()=>{
  const settings=normalizeOptions({...DEFAULT_OPTIONS,eventAccent:'rose',eventFamily:'mono',eventMotionMs:540});
  expect(settings.eventAccent).toBe('rose');
  expect(settings.eventFamily).toBe('mono');
  expect(settings.eventMotionMs).toBe(540);
  const url=writeOptions(settings,'events');
  expect(url).toContain('eventAccent=rose');
  expect(url).toContain('eventFamily=mono');
  expect(url).toContain('eventMotionMs=540');
  expect(readOptions('?'+url,'events')).toEqual(settings);
  expect(DEFAULT_OPTIONS.eventAccent).toBe('theme');
  expect(DEFAULT_OPTIONS.eventFamily).toBe('system');
  expect(DEFAULT_OPTIONS.eventMotionMs).toBe(340);
  expect(isOptionApplicable('eventMotionMs',settings)).toBe(true);
  expect(isOptionApplicable('eventMotionMs',normalizeOptions({eventMotion:'none'}))).toBe(false);
  expect(normalizeOptions({eventMotionMs:5000}).eventMotionMs).toBe(1500);
  expect(normalizeOptions({eventMotionMs:10}).eventMotionMs).toBe(100);
 });
 it('ships every new entrance and exit as a real event animation',()=>{
  const entrances=['blur-focus','curtain-wipe','glitch-split','dissolve','split-flap','fold-collapse'];
  const exits=['blur-out','curtain-close','glitch-split','dissolve','split-flap','fold-collapse'];
  for(const value of entrances){
   expect(optionsForEditor('events',false).find(x=>x.key==='eventMotion')?.choices?.some(x=>x.value===value)).toBe(true);
   expect(css).toContain(`data-motion="${value}"`);
   expect(css).toContain(`@keyframes event-${value}`);
  }
  for(const value of exits){
   expect(optionsForEditor('events',false).find(x=>x.key==='eventExit')?.choices?.some(x=>x.value===value)).toBe(true);
   expect(css).toContain(`data-exit="${value}"`);
   expect(css).toContain(`@keyframes event-out-${value}`);
  }
  expect(css).toContain('var(--event-enter-duration,340ms)');
  expect(css).toContain('prefers-reduced-motion:reduce');
 });
 it('applies accent, typeface and entrance timing to the real alert surface',()=>{
  const root=document.createElement('div');
  const overlay=createEventOverlay(root,{accent:'violet',fontFamily:'serif',motionMs:620});
  const surface=root.querySelector<HTMLElement>('.overlay-events')!;
  expect(surface.dataset.accent).toBe('violet');
  expect(surface.dataset.family).toBe('serif');
  expect(surface.style.getPropertyValue('--event-enter-duration')).toBe('620ms');
  overlay.configure({accent:'amber',fontFamily:'mono',motionMs:280});
  expect(surface.dataset.accent).toBe('amber');
  expect(surface.dataset.family).toBe('mono');
  expect(surface.style.getPropertyValue('--event-enter-duration')).toBe('280ms');
  expect(css).toContain('[data-accent="violet"]');
  expect(css).toContain('[data-family="serif"]');
  overlay.dispose();
 });
});
