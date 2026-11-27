// @vitest-environment jsdom
import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_OPTIONS,isOptionApplicable,normalizeOptions,optionsForEditor,
  readOptions,writeOptions,
} from '../src/options';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import type {DisplayMessage} from '../src/chatbus';

const message:DisplayMessage={
  id:'animation-controls',timestamp:1,platform:'twitch',
  user:{name:'Tester',badges:[]},parts:[{type:'text',text:'Letters and bubbles animate separately.'}],
};
const visible=(value:Record<string,unknown>,key:keyof typeof DEFAULT_OPTIONS)=>
  isOptionApplicable(key,normalizeOptions(value));

describe('contextual chat animation timing controls',()=>{
  it('hides Movement duration when smooth movement is off, without discarding the value',()=>{
    expect(visible({},'reflowMs')).toBe(false);
    expect(visible({smoothReflow:true},'reflowMs')).toBe(true);
    const configured=normalizeOptions({smoothReflow:false,reflowMs:560});
    expect(configured.reflowMs).toBe(560);
    expect(writeOptions(configured,'chat')).toContain('reflowMs=560');
    expect(readOptions('?reflowMs=560&smoothReflow=0','chat').reflowMs).toBe(560);
  });
  it('adds an independent Letter entrance duration directly after Letter entrance',()=>{
    const definitions=optionsForEditor('chat',false);
    const at=definitions.findIndex(x=>x.key==='letterEnter');
    expect(definitions[at+1]).toMatchObject({
      key:'letterEnterMs',label:'Letter entrance duration',kind:'range',
      section:'Chat • Animations',min:120,max:1200,step:20,unit:'ms',
    });
    expect(DEFAULT_OPTIONS.letterEnterMs).toBe(320);
    expect(visible({letterEnter:'none'},'letterEnterMs')).toBe(false);
    expect(visible({letterEnter:'scramble'},'letterEnterMs')).toBe(true);
    expect(visible({letterEnter:'rise',enter:'none'},'letterEnterMs')).toBe(true);
    expect(visible({letterEnter:'none',enter:'rise'},'letterEnterMs')).toBe(false);
  });
  it('hides the existing Message entrance duration when the message entrance is None',()=>{
    expect(visible({enter:'none'},'enterMs')).toBe(false);
    expect(visible({enter:'pop'},'enterMs')).toBe(true);
    expect(visible({enter:'none',letterEnter:'pop'},'enterMs')).toBe(false);
    expect(visible({enter:'none',letterEnter:'pop'},'letterEnterMs')).toBe(true);
  });
  it('preserves custom timing for hidden controls in Chat links and versioned presets',()=>{
    const settings=normalizeOptions({
      enter:'none',enterMs:820,
      letterEnter:'none',letterEnterMs:660,
      smoothReflow:false,reflowMs:580,
    });
    expect(settings.enterMs).toBe(820);
    expect(settings.letterEnterMs).toBe(660);
    expect(settings.reflowMs).toBe(580);
    const query=writeOptions(settings,'chat');
    expect(query).toContain('enterMs=820');
    expect(query).toContain('letterEnterMs=660');
    expect(query).toContain('reflowMs=580');
    expect(readOptions('?'+query,'chat')).toEqual(settings);
    expect(writeOptions(settings,'wall')).not.toContain('letterEnterMs');
    const imported=normalizeOptions({version:1,settings});
    expect(imported.letterEnterMs).toBe(660);
  });
  it('explicitly serializes a default letter duration when a nondefault message duration would override it on legacy import',()=>{
    const settings=normalizeOptions({...DEFAULT_OPTIONS,enterMs:460,letterEnterMs:320});
    const url=writeOptions(settings,'chat');
    expect(url).toContain('enterMs=460');
    expect(url).toContain('letterEnterMs=320');
    expect(readOptions('?'+url,'chat')).toEqual(settings);
    const old=readOptions('?enterMs=460&letterEnter=rise','chat');
    expect(old.letterEnterMs).toBe(460);
    expect(writeOptions(old,'chat')).toContain('letterEnterMs=460');
  });
  it('migrates legacy shared entrance timing to separate letter timing if not explicitly set',()=>{
    expect(readOptions('?enterMs=720&letterEnter=rise','chat').letterEnterMs).toBe(720);
    expect(normalizeOptions({enterMs:680,letterEnter:'scramble'}).letterEnterMs).toBe(680);
    expect(normalizeOptions({version:1,settings:{enterMs:560,letterEnter:'wave'}}).letterEnterMs).toBe(560);
    expect(normalizeOptions({enterMs:800,letterEnterMs:480,letterEnter:'rise'}).letterEnterMs).toBe(480);
    expect(normalizeOptions({letterEnterMs:-100}).letterEnterMs).toBe(120);
    expect(normalizeOptions({letterEnterMs:10000}).letterEnterMs).toBe(1200);
    expect(normalizeOptions({letterEnterMs:'wat'}).letterEnterMs).toBe(320);
  });
  it('uses separate durations for row entrance and letter effects without altering message content',()=>{
    const row=createChatMessageElement(message,{
      enter:'pop',letterEnter:'rise',enterMs:400,letterEnterMs:840,
    });
    expect(row.style.getPropertyValue('--chat-enter-duration')).toBe('400ms');
    expect(row.style.getPropertyValue('--chat-letter-enter-duration')).toBe('840ms');
    expect(row.dataset.enter).toBe('pop');
    expect(row.dataset.letterEnter).toBe('rise');
    expect(row.querySelectorAll('.overlay-letter').length).toBeGreaterThan(10);
    expect(row.querySelector('.overlay-message-content')?.textContent).toBe(message.parts[0]!.type==='text'?message.parts[0]!.text:'');
    const css=readFileSync('src/chat-motion.css','utf8');
    expect(css).toMatch(/data-letter-enter="rise"[^}]+--chat-letter-enter-duration/u);
    expect(css).toContain('animation: chat-in-pop var(--chat-enter-duration');
    expect(css).not.toMatch(/chat-letter-in-rise var\(--chat-enter-duration/u);
  });
  it('uses Letter entrance duration for Scramble, not the separate message entrance duration',()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T00:00:00Z'));
    const root=document.createElement('div');
    try{
      const feed=createChatFeed(root,{enter:'pop',enterMs:120,
        letterEnter:'scramble',letterEnterMs:800,ttlMs:120000,exit:'none'});
      feed.receive(message);
      const letter=root.querySelector<HTMLElement>('[data-scramble-ready]')!;
      expect(letter.dataset.scrambling).toBe('true');
      vi.advanceTimersByTime(300);
      expect(letter.dataset.scrambling).toBe('true');
      vi.advanceTimersByTime(1300);
      expect(letter.dataset.scrambling).toBeUndefined();
      feed.dispose();
    }finally{vi.useRealTimers();}
  });
  it('allows independent durations in a live feed without resetting an admitted row',()=>{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{enter:'scale',enterMs:540,letterEnter:'rise',letterEnterMs:940,ttlMs:120000});
    feed.receive(message);
    const row=root.querySelector<HTMLElement>('[data-message-id="animation-controls"]')!;
    const admitted=feed.snapshot()[0]!.enteredAt;
    expect(row.style.getPropertyValue('--chat-enter-duration')).toBe('540ms');
    expect(row.style.getPropertyValue('--chat-letter-enter-duration')).toBe('940ms');
    feed.configure({enter:'none',letterEnter:'none',smoothReflow:false});
    expect(root.querySelector('[data-message-id="animation-controls"]')).toBe(row);
    expect(feed.snapshot()[0]!.enteredAt).toBe(admitted);
    feed.dispose();
  });
});
