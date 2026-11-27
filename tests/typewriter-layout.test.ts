import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatFeed } from '../src/views';
import { createChatMessageElement } from '../src/renderers';
import type { DisplayMessage } from '../src/chatbus';

const message = (id:string):DisplayMessage => ({
  id, timestamp:1, user:{name:'StreamElements',badges:[]},
  parts:[
    {type:'text',text:'I visited Pompeii and found this https://example.com/pompeii/history'},
    {type:'emote',emote:{id:'happy',code:'happy',url:'https://example.com/happy.png',overlays:[],modifiers:[]}},
  ],
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('true progressive typewriter without invisible reserved layout',()=>{
  it('retains standalone text visibility, mixed link and emote content, and typewriter step markers',()=>{
    const row=createChatMessageElement(message('alone'),{letterEnter:'typewriter',linkDisplay:'compact'});
    const content=row.querySelector<HTMLElement>('.overlay-message-content')!;
    const steps=Array.from(content.querySelectorAll<HTMLElement>('.overlay-typewriter-step'));
    expect(steps.length).toBeGreaterThan(35);
    // Renderer can also be consumed standalone, outside createChatFeed. Its
    // full text must never remain invisibly hidden without a timer owner.
    expect(steps.every(step=>step.style.display==='')).toBe(true);
    expect(content.querySelectorAll('.overlay-typewriter-space').length).toBeGreaterThan(5);
    expect(content.querySelectorAll('[data-overlay-link]')).toHaveLength(1);
    expect(content.querySelectorAll('.overlay-emote img')).toHaveLength(1);
    expect(content.textContent).toContain('I visited Pompeii and found this ↗ example.com/pompeii/…');
    expect(content.textContent).not.toContain('↗ link |');
  });

  it('reveals only elapsed graphemes while an older row moves and the newer starts typing',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createChatFeed(root,{enter:'none',exit:'none',letterEnter:'typewriter',letterEnterMs:420,ttlMs:30000,smoothReflow:true});
    wall.receive(message('one'));
    const first=root.querySelector<HTMLElement>('[data-message-id="one"]')!;
    const steps=Array.from(first.querySelectorAll<HTMLElement>('.overlay-typewriter-step'));
    const visible=()=>steps.filter(step=>step.style.display!=='none').length;
    expect(visible()).toBe(1);
    expect(first.querySelector('.overlay-typewriter-caret')).not.toBeNull();
    vi.advanceTimersByTime(280);
    const before=visible();
    expect(before).toBeGreaterThan(1);
    expect(before).toBeLessThan(steps.length);
    wall.receive(message('two'));
    expect(visible()).toBe(before);
    const second=root.querySelector<HTMLElement>('[data-message-id="two"]')!;
    expect(second.querySelectorAll<HTMLElement>('.overlay-typewriter-step').length).toBe(steps.length);
    expect(second.querySelectorAll<HTMLElement>('.overlay-typewriter-step:not([style*="display: none"])').length).toBe(1);
    vi.advanceTimersByTime(350);
    expect(visible()).toBeGreaterThan(before);
    expect(visible()).toBeLessThan(steps.length);
    vi.advanceTimersByTime(20000);
    expect(visible()).toBe(steps.length);
    expect(first.querySelector('.overlay-typewriter-caret')).toBeNull();
    expect(first.querySelector('.overlay-message-content')?.textContent).toContain('I visited Pompeii');
    wall.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reveals remaining pending text at early exit; reduced motion never hides it',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createChatFeed(root,{letterEnter:'typewriter',exit:'fade',ttlMs:100,exitMs:500});
    wall.receive(message('exit'));
    vi.advanceTimersByTime(100);
    const exiting=root.querySelector('[data-message-id="exit"]')!;
    expect(exiting.querySelector('.overlay-wall-visual')).toBeNull();
    expect(Array.from(exiting.querySelectorAll<HTMLElement>('.overlay-typewriter-step')).every(step=>step.style.display!=='none')).toBe(true);
    wall.dispose();

    vi.stubGlobal('matchMedia',()=>({matches:true}));
    const accessible=document.createElement('div');
    const reduced=createChatFeed(accessible,{letterEnter:'typewriter'});
    reduced.receive(message('reduced'));
    expect(Array.from(accessible.querySelectorAll<HTMLElement>('.overlay-typewriter-step')).every(step=>step.style.display!=='none')).toBe(true);
    expect(accessible.querySelector('.overlay-typewriter-caret')).toBeNull();
    reduced.dispose();
  });

  it('does not expose an unfinished partial animation for over-budget source text',()=>{
    const row=createChatMessageElement({
      ...message('long'),parts:[{type:'text',text:'word '.repeat(60)}],
    },{letterEnter:'typewriter'});
    expect(row.dataset.letterEnter).toBeUndefined();
    expect(row.querySelector('.overlay-typewriter-step')).toBeNull();
    expect(row.querySelector('.overlay-message-content')?.textContent).toBe('word '.repeat(60));
  });
});
