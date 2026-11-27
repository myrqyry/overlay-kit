import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createChatFeed, createEmoteWall } from '../src/views';
import { createEventOverlay } from '../src/events';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, optionsForEditor } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';
import type { SocialSignalV1 } from '@myrqyry/chatbus';

const chat:DisplayMessage={id:'msg',timestamp:1000,user:{name:'Viewer',badges:[]},parts:[{type:'text',text:'Hello!'}]};
const emote:DisplayMessage={...chat,parts:[{type:'emote',emote:{id:'heart',code:'Heart',url:'/heart.svg',overlays:[],modifiers:[]}}]};
const signal:SocialSignalV1={schemaVersion:1,producer:'chatbus',source:{platform:'twitch',channelName:'garden',origin:'live'},event:{type:'subscription',id:'sub1',occurredAtMs:1000,receivedAtMs:1000},actor:{platform:'twitch',username:'viewer',displayName:'Viewer'}};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('optional motion across overlay surfaces',()=>{
  it('exposes new motion choices in the correct editor sections and round-trips their OBS URL parameters',()=>{
    for(const [key,values,view] of [
      ['enter',['unfurl','soft-land'],'chat'],
      ['exit',['float-away','tuck'],'chat'],
      ['wallEnter',['unfurl','spring'],'wall'],
      ['wallExit',['lift','tumble'],'wall'],
      ['eventMotion',['sweep','unfold'],'events'],
    ] as const){
      const option=optionsForEditor(view,false).find(x=>x.key===key);
      for(const value of values){
        expect(option?.choices?.some(x=>x.value===value)).toBe(true);
        const settings=normalizeOptions({...DEFAULT_OPTIONS,[key]:value});
        expect(settings[key]).toBe(value);
        expect(readOptions('?'+writeOptions(settings,view),view)[key]).toBe(value);
      }
    }
    expect(DEFAULT_OPTIONS.enter).toBe('rise');
    expect(DEFAULT_OPTIONS.wallEnter).toBe('none');
    expect(DEFAULT_OPTIONS.eventMotion).toBe('rise');
  });
  it('runs both new chat entrances and retires new exits on matching animationend',()=>{
    vi.useFakeTimers();
    for(const [enter,exit] of [['unfurl','float-away'],['soft-land','tuck']] as const){
      const root=document.createElement('div');
      const feed=createChatFeed(root,{enter,exit,ttlMs:100,exitMs:180});
      feed.receive({...chat,id:enter});
      const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
      expect(row.dataset.enter).toBe(enter);
      vi.advanceTimersByTime(100);
      expect(row.dataset.phase).toBe('exiting');
      expect(row.dataset.exit).toBe(exit);
      const completed=new Event('animationend',{bubbles:true});
      Object.defineProperty(completed,'animationName',{value:'chat-out-'+exit});
      row.dispatchEvent(completed);
      expect(root.childElementCount).toBe(0);
      feed.dispose();
    }
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps wall one-shot animation separate from item motion and cleans up new exits',()=>{
    vi.useFakeTimers();
    for(const [enter,exit] of [['unfurl','lift'],['spring','tumble']] as const){
      const root=document.createElement('div');
      const wall=createEmoteWall(root,{wallEnter:enter,wallExit:exit,motion:'sway',ttlMs:100,wallExitMs:180});
      wall.receive({...emote,id:enter});
      const item=root.querySelector<HTMLElement>('[data-wall-item]')!;
      const visual=item.querySelector<HTMLElement>('.overlay-wall-visual')!;
      expect(item.dataset.motion).toBe('sway');
      expect(visual.dataset.wallEnter).toBe(enter);
      vi.advanceTimersByTime(100);
      expect(visual.dataset.wallPhase).toBe('exiting');
      const completed=new Event('animationend',{bubbles:true});
      Object.defineProperty(completed,'animationName',{value:'wall-out-'+exit});
      visual.dispatchEvent(completed);
      expect(root.childElementCount).toBe(0);
      wall.dispose();
    }
    expect(vi.getTimerCount()).toBe(0);
  });
  it('exposes event motions on the actual alert surface and disposes its timer',()=>{
    vi.useFakeTimers();
    for(const motion of ['sweep','unfold'] as const){
      const root=document.createElement('div');
      const overlay=createEventOverlay(root,{motion,durationMs:1000});
      overlay.receive(signal);
      expect(root.querySelector('.overlay-events')?.getAttribute('data-motion')).toBe(motion);
      expect(root.querySelector('.overlay-event-alert')?.textContent).toContain('Viewer');
      overlay.dispose();
      expect(root.childElementCount).toBe(0);
    }
    expect(vi.getTimerCount()).toBe(0);
  });
  it('adds editor microinteractions without indefinite motion or a reduced-motion penalty',()=>{
    const css=readFileSync('demo/styles.css','utf8');
    expect(css).toContain('.option-section[open] .option-row');
    expect(css).toContain('animation: inspector-row-arrive');
    expect(css).toContain('.workspace-tab[aria-selected="true"] .tab-indicator');
    expect(css).toContain('.preview-card[data-active="true"]');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('.option-section[open] .option-row { animation: none !important; }');
  });
  it('ships matching CSS keyframes and reduced-motion fallbacks rather than inert options',()=>{
    const chatCss=readFileSync('src/chat-motion.css','utf8');
    const wallCss=readFileSync('src/wall-motion.css','utf8');
    const eventCss=readFileSync('src/events.css','utf8');
    for(const name of ['unfurl','soft-land']){
      expect(chatCss).toContain(`data-enter="${name}"`);
      expect(chatCss).toContain(`@keyframes chat-in-${name}`);
    }
    for(const name of ['float-away','tuck']){
      expect(chatCss).toContain(`data-exit="${name}"`);
      expect(chatCss).toContain(`@keyframes chat-out-${name}`);
    }
    for(const name of ['unfurl','spring']){
      expect(wallCss).toContain(`data-wall-enter="${name}"`);
      expect(wallCss).toContain(`@keyframes wall-in-${name}`);
    }
    for(const name of ['lift','tumble']){
      expect(wallCss).toContain(`data-wall-exit="${name}"`);
      expect(wallCss).toContain(`@keyframes wall-out-${name}`);
    }
    for(const name of ['sweep','unfold']){
      expect(eventCss).toContain(`data-motion="${name}"`);
      expect(eventCss).toContain(`@keyframes event-${name}`);
    }
    expect(chatCss).toContain('prefers-reduced-motion: reduce');
    expect(wallCss).toContain('prefers-reduced-motion: reduce');
    expect(eventCss).toContain('prefers-reduced-motion:reduce');
  });
});
