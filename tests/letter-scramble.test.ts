import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatMessageElement } from '../src/renderers';
import { createChatFeed } from '../src/views';
import { startLetterScramble } from '../src/letter-motion';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const mixed: DisplayMessage = {
  id: 'scramble-1', timestamp: 1,
  user: { id: 'viewer', name: 'Viewer', badges: [{name:'Mod', url:'https://example.com/mod.png'}] },
  parts: [
    {type:'text',text:'Hello 👩🏽‍💻 café! '},
    {type:'mention',text:'@someone'},
    {type:'emote',emote:{id:'smile',code:'Smile',url:'https://example.com/smile.png',overlays:[],modifiers:[]}},
    {type:'media',url:'https://example.com/photo.png',mediaType:'image',text:'Photo',alt:'Photo'},
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('glitch scramble letter entrance', () => {
  it('is opt-in and roundtrips through Chat URLs without affecting Wall', () => {
    expect(DEFAULT_OPTIONS.letterEnter).toBe('none');
    const settings=normalizeOptions({...DEFAULT_OPTIONS,letterEnter:'scramble'});
    expect(settings.letterEnter).toBe('scramble');
    expect(readOptions('?'+writeOptions(settings,'chat'),'chat').letterEnter).toBe('scramble');
    expect(writeOptions(settings,'wall')).not.toContain('letterEnter');
    expect(normalizeOptions({letterEnter:'invalid'}).letterEnter).toBe('none');
  });

  it('preserves original graphemes and all non-text content', () => {
    const el=createChatMessageElement(mixed,{letterEnter:'scramble'});
    const content=el.querySelector<HTMLElement>('.overlay-message-content')!;
    expect(content.textContent).toBe('Hello 👩🏽‍💻 café! @someone');
    expect(content.querySelectorAll('[data-scramble-ready]').length).toBeGreaterThan(8);
    expect(content.querySelector('[data-scramble-ready]')?.textContent).toBe('H');
    expect(Array.from(content.querySelectorAll('[data-scramble-ready]')).some(x=>x.textContent==='é')).toBe(true);
    expect(content.querySelectorAll('[data-scramble]')).toHaveLength(0);
    expect(content.querySelectorAll('img')).toHaveLength(2);
    expect(el.querySelector('[data-badge-container] img')).not.toBeNull();
    expect(el.querySelector('[data-username]')?.textContent).toBe('Viewer');
    expect(content.querySelectorAll('.overlay-letter')).toHaveLength(
      [...'Hello café! @someone'].filter(x => x !== ' ').length + 1 // emoji grapheme
    );
  });

  it('scrambles over unchanged real letters, reveals in sequence, then restores cleanly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const el=createChatMessageElement(mixed,{letterEnter:'scramble'});
    const content=el.querySelector<HTMLElement>('.overlay-message-content')!;
    const text=content.textContent;
    const ready=Array.from(el.querySelectorAll<HTMLElement>('[data-scramble-ready]'));
    const done=vi.fn();
    const stop=startLetterScramble(el,180,done);
    expect(ready.every(x=>x.dataset.scrambling==='true')).toBe(true);
    expect(content.textContent).toBe(text);
    const initial=ready[0]!.dataset.scramble;
    vi.advanceTimersByTime(110);
    expect(content.textContent).toBe(text);
    expect(ready[0]!.dataset.scramble).not.toBe(initial);
    vi.advanceTimersByTime(120);
    expect(ready[0]!.dataset.scrambling).toBeUndefined();
    expect(ready.at(-1)!.dataset.scrambling).toBe('true');
    vi.advanceTimersByTime(1000);
    expect(ready.every(x=>x.dataset.scrambling===undefined && x.dataset.scramble===undefined)).toBe(true);
    expect(content.textContent).toBe(text);
    expect(done).toHaveBeenCalledTimes(1);
    stop();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('cancels without any mutation after removal, and respects reduced motion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const el=createChatMessageElement(mixed,{letterEnter:'scramble'});
    const done=vi.fn();
    const stop=startLetterScramble(el,320,done);
    stop();
    const raw=el.textContent;
    vi.advanceTimersByTime(2000);
    expect(el.textContent).toBe(raw);
    expect(el.querySelector('[data-scrambling]')).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);

    vi.stubGlobal('matchMedia',()=>({matches:true}));
    const reduced=createChatMessageElement(mixed,{letterEnter:'scramble'});
    startLetterScramble(reduced,320);
    expect(reduced.querySelector('[data-scrambling]')).toBeNull();
  });

  it('ends scrambled glyphs on natural expiration and on moderation, with no leftover text overlays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const root=document.createElement('div');
    const feed=createChatFeed(root,{letterEnter:'scramble',enterMs:1000,ttlMs:2000,exit:'none'});
    feed.receive(mixed);
    expect(root.querySelectorAll('[data-scrambling]').length).toBeGreaterThan(5);
    feed.removeMessage('scramble-1');
    expect(root.querySelector('[data-scrambling]')).toBeNull();
    expect(root.textContent).not.toContain('Hello');
    vi.advanceTimersByTime(3000);
    expect(feed.snapshot()).toHaveLength(0);
    feed.dispose();

    const other=createChatFeed(root,{letterEnter:'scramble',enterMs:1000,ttlMs:100,exit:'none'});
    other.receive(mixed);
    vi.advanceTimersByTime(100);
    expect(root.querySelector('.overlay-chat-message')).toBeNull();
    vi.advanceTimersByTime(2000);
    other.dispose();
  });

  it('limits simultaneous scrambling rows and lets oversized messages leave existing effects alone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
    const root=document.createElement('div');
    const feed=createChatFeed(root,{letterEnter:'scramble',enterMs:1200,maxActive:30,ttlMs:40000});
    for(let i=0;i<9;i++) feed.receive({...mixed,id:'burst-'+i});
    expect(root.querySelectorAll('.overlay-chat-message [data-scrambling]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.overlay-chat-message').length).toBe(9);
    expect(root.querySelectorAll('.overlay-chat-message')[0]?.querySelector('[data-scrambling]')).toBeNull();
    const animated=Array.from(root.querySelectorAll('.overlay-chat-message')).filter(x=>x.querySelector('[data-scrambling]'));
    expect(animated).toHaveLength(8);
    feed.receive({...mixed,id:'very-long',parts:[{type:'text',text:'Z'.repeat(800)}]});
    const remaining=Array.from(root.querySelectorAll('.overlay-chat-message')).filter(x=>x.querySelector('[data-scrambling]'));
    expect(remaining).toHaveLength(8);
    feed.dispose();
    expect(root.querySelector('[data-scrambling]')).toBeNull();
  });

  it('falls back safely to the regular row entrance for oversized messages', () => {
    const long:DisplayMessage={...mixed,parts:[{type:'text',text:'A'.repeat(500)}]};
    const root=document.createElement('div');
    const feed=createChatFeed(root,{letterEnter:'scramble',enter:'rise'});
    feed.receive(long);
    expect(root.querySelectorAll('[data-scrambling]')).toHaveLength(0);
    expect(root.textContent).toContain('A'.repeat(500));
    feed.dispose();
  });
});
