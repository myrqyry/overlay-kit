import { describe, expect, it, vi } from 'vitest';
import { createChatMessageElement } from '../src/renderers';
import { startChatExit } from '../src/chat-motion';
import { DEFAULT_OPTIONS, normalizeOptions, optionsForEditor, writeOptions } from '../src/options';
import { restoreSeparateSettings } from '../src/editor-settings';
import type { DisplayMessage } from '../src/chatbus';

const msg:DisplayMessage = {
  id:'complex', timestamp:1, user:{ name:'V', badges:[] },
  parts:[
    {type:'text',text:'Hi 👩🏽‍💻 café! '},
    {type:'mention',text:'@you'},
    {type:'text',text:' stop'},
  ],
};

describe('transparent chat bubble styling', () => {
  it('does not paint a box shadow behind a completely transparent bubble but keeps text shadow', () => {
    const el=createChatMessageElement(msg,{backgroundAlpha:0,shadow:'strong'});
    expect(el.style.boxShadow).toBe('none');
    expect(el.style.textShadow).toContain('rgba(0,0,0');
    const opaque=createChatMessageElement(msg,{backgroundAlpha:70,shadow:'none'});
    expect(opaque.style.boxShadow).not.toBe('none');
    expect(opaque.style.textShadow).toBe('none');
  });
});

describe('independent overlay configurations', () => {
  it('offers zero Shared options and independent chat/wall capacity controls', () => {
    expect(optionsForEditor('chat',true).some(o=>o.section.startsWith('Shared'))).toBe(false);
    expect(optionsForEditor('wall',true).some(o=>o.section.startsWith('Shared'))).toBe(false);
    const chat=optionsForEditor('chat',true);
    const wall=optionsForEditor('wall',true);
    expect(chat.map(o=>o.key)).toContain('max');
    expect(wall.map(o=>o.key)).toContain('wallMax');
    expect(wall.map(o=>o.key)).toContain('wallTtl');
    expect(wall.map(o=>o.key)).toContain('wallSize');
    expect(new Set(chat.map(o=>o.key)).size + new Set(wall.map(o=>o.key)).size)
      .toBe(new Set([...chat,...wall].map(o=>o.key)).size);
  });
  it('imports a former combined settings link into each overlay rather than dropping half its options', () => {
    const restored=restoreSeparateSettings(null,null,'?font=36&max=12&motion=bounce&wallSize=94&ref=bookmark');
    expect(restored.chat.font).toBe(36);
    expect(restored.chat.max).toBe(12);
    expect(restored.wall.motion).toBe('bounce');
    expect(restored.wall.wallSize).toBe(94);
    expect(restored.remainingSearch).toBe('ref=bookmark');
  });

  it('migrates old workspace edits into separate chat and wall values, independently', () => {
    const old={version:1,settings:normalizeOptions({...DEFAULT_OPTIONS,max:12,ttl:40,size:87,font:31,wallSpeed:2})};
    const state=restoreSeparateSettings(old,null,'');
    expect(state.chat.max).toBe(12);
    expect(state.chat.font).toBe(31);
    expect(state.wall.wallMax).toBe(12);
    expect(state.wall.wallTtl).toBe(40);
    expect(state.wall.wallSize).toBe(87);
    expect(state.wall.wallSpeed).toBe(2);
    state.chat.max=22;
    state.chat.size=32;
    expect(state.wall.wallMax).toBe(12);
    expect(state.wall.wallSize).toBe(87);
    const query=writeOptions(state.wall,'wall');
    expect(query).toContain('wallMax=12');
    expect(query).not.toContain('font=');
  });
});

describe('per-letter chat motion', () => {
  it('keeps grapheme clusters whole and preserves text/mention content', () => {
    const el=createChatMessageElement(msg,{letterEnter:'rise',letterExit:'fade'});
    const spans=Array.from(el.querySelectorAll<HTMLElement>('.overlay-letter'));
    expect(spans.length).toBeGreaterThan(12);
    expect(spans.some(span=>span.textContent==='👩🏽‍💻')).toBe(true);
    expect(el.querySelector('.overlay-message-content')?.textContent)
      .toBe('Hi 👩🏽‍💻 café! @you stop');
    expect(el.querySelector('[data-mention="true"]')).not.toBeNull();
  });
  it('does not create hundreds of elements for huge messages or when disabled', () => {
    const plain=createChatMessageElement(msg,{letterEnter:'none',letterExit:'none'});
    expect(plain.querySelectorAll('.overlay-letter')).toHaveLength(0);
    const long={...msg,parts:[{type:'text' as const,text:'A'.repeat(1000)}]};
    const bounded=createChatMessageElement(long,{letterEnter:'rise'});
    expect(bounded.querySelectorAll('.overlay-letter').length).toBeLessThanOrEqual(120);
    expect(bounded.textContent).toContain('A'.repeat(1000));
  });
  it('waits for the per-letter exit sequence before removing an expired bubble', () => {
    vi.useFakeTimers();
    const el=createChatMessageElement(msg,{letterExit:'fade'});
    let ended=0;
    const cancel=startChatExit(el,'fade',200,()=>ended++);
    expect(el.dataset.phase).toBe('exiting');
    vi.advanceTimersByTime(201);
    expect(ended).toBe(0);
    vi.advanceTimersByTime(2500);
    expect(ended).toBe(1);
    cancel();
    vi.useRealTimers();
  });
});
