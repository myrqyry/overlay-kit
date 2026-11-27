import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createChatFeed } from '../src/views';

const css = readFileSync('src/chat-motion.css', 'utf8');
const packet=(id:string,text:string)=>({
  id,timestamp:1,user:{name:id,badges:[]},
  parts:[{type:'text' as const,text}],
});

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('typewriter caret and non-interrupting incoming messages',()=>{
  it.each([false,true])('continues the previous row as new chat reflows (smooth movement %s)',smoothReflow=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const feed=createChatFeed(root,{
      letterEnter:'typewriter',letterEnterMs:480,enter:'none',exit:'none',
      smoothReflow,ttlMs:60000,
    });
    const original='The first message keeps typing and does not jump to the last letter when someone replies.';
    feed.receive(packet('first',original));
    const first=root.querySelector<HTMLElement>('[data-message-id="first"]')!;
    const letterCount=first.querySelectorAll('.overlay-letter').length;
    const caret=first.querySelector<HTMLElement>('.overlay-typewriter-caret')!;
    expect(caret).not.toBeNull();
    expect(caret.getAttribute('aria-hidden')).toBe('true');
    expect(first.querySelector('.overlay-message-content')?.textContent).toBe(original);
    expect(first.querySelectorAll('.overlay-typewriter-caret')).toHaveLength(1);
    const initial=Number(caret.previousElementSibling?.getAttribute('style')?.match(/--letter-index:\s*(\d+)/)?.[1]||0);
    vi.advanceTimersByTime(160);
    const before=Number((caret.previousElementSibling as HTMLElement)?.style.getPropertyValue('--letter-index'));
    expect(before).toBeGreaterThan(initial);
    feed.receive(packet('second','New message arrives and starts typing too.'));
    expect(root.querySelector('[data-message-id="first"]')).toBe(first);
    expect(first.dataset.typewriterComplete).toBeUndefined();
    expect(first.querySelectorAll('.overlay-letter')).toHaveLength(letterCount);
    expect(first.querySelector('.overlay-message-content')?.textContent).toBe(original);
    const second=root.querySelector<HTMLElement>('[data-message-id="second"]')!;
    expect(second.querySelectorAll('.overlay-typewriter-caret')).toHaveLength(1);
    expect(first.querySelectorAll('.overlay-typewriter-caret')).toHaveLength(1);
    vi.advanceTimersByTime(240);
    const after=Number((caret.previousElementSibling as HTMLElement)?.style.getPropertyValue('--letter-index'));
    expect(after).toBeGreaterThan(before);
    expect(css).not.toContain('animation: chat-letter-in-typewriter');
    expect(css).toContain('progressive DOM reveal');
    expect(css).not.toContain('data-typewriter-complete');
    feed.dispose();
    expect(root.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cursor stops once all graphemes are revealed, with no text, emote or timers leaked',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const feed=createChatFeed(root,{letterEnter:'typewriter',letterEnterMs:320,ttlMs:60000,exit:'none'});
    feed.receive(packet('one','Hello 👩🏽‍💻 café'));
    const row=root.querySelector<HTMLElement>('[data-message-id="one"]')!;
    const text=row.querySelector('.overlay-message-content')?.textContent;
    const caret=row.querySelector('.overlay-typewriter-caret');
    expect(caret).not.toBeNull();
    vi.advanceTimersByTime(5000);
    expect(row.querySelector('.overlay-typewriter-caret')).toBeNull();
    expect(row.querySelector('.overlay-message-content')?.textContent).toBe(text);
    feed.removeMessage('one');
    expect(vi.getTimerCount()).toBe(0);
    feed.dispose();
  });

  it('tears down cursor immediately on moderation, refresh, clear and reduced-motion',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const feed=createChatFeed(root,{letterEnter:'typewriter',ttlMs:60000});
    feed.receive(packet('first','First message with a moving cursor'));
    expect(root.querySelector('.overlay-typewriter-caret')).not.toBeNull();
    feed.removeMessage('first');
    expect(root.querySelector('.overlay-typewriter-caret')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    feed.receive(packet('second','Second message with a moving cursor'));
    feed.refreshAppearance();
    expect(root.querySelector('.overlay-typewriter-caret')).toBeNull();
    feed.receive(packet('third','Third message with a moving cursor'));
    expect(root.querySelector('.overlay-typewriter-caret')).not.toBeNull();
    feed.clear();
    expect(root.querySelector('.overlay-typewriter-caret')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    feed.dispose();

    vi.stubGlobal('matchMedia',()=>({matches:true}));
    const reducedRoot=document.createElement('div');
    const reduced=createChatFeed(reducedRoot,{letterEnter:'typewriter'});
    reduced.receive(packet('reduced','Text should remain accessible'));
    expect(reducedRoot.querySelector('.overlay-typewriter-caret')).toBeNull();
    reduced.dispose();
  });

  it('defines a visual-only blinking caret that respects reduced motion',()=>{
    expect(css).toContain('.overlay-typewriter-caret');
    expect(css).toContain('@keyframes chat-typewriter-caret-blink');
    expect(css).toMatch(/\.overlay-typewriter-caret\s*\{[^}]*animation:\s*chat-typewriter-caret-blink/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.overlay-typewriter-caret\s*\{[^}]*animation:\s*none\s*!important/);
  });
});
