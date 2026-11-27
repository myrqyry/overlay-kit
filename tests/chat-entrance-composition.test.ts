// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import type {DisplayMessage} from '../src/chatbus';
const sample:DisplayMessage={
  id:'both',timestamp:1,platform:'twitch',
  user:{name:'Sender',color:'#ffaa00',badges:[]},
  parts:[{type:'text',text:'Hello, new chat!'}],
};
describe('message and letter entrances compose instead of blocking each other',()=>{
  it('never disables the row entrance when letter entrance is selected',()=>{
    const css=readFileSync('src/chat-motion.css','utf8');
    expect(css).not.toMatch(/\.overlay-chat-message[^\n{]*\[data-letter-enter\][^{]*\{\s*animation:\s*none\s*;/u);
    expect(css).toContain('animation: chat-in-pop');
    expect(css).toContain('animation: chat-letter-in-rise');
  });
  it('retains both independent effects on the same row',()=>{
    const row=createChatMessageElement(sample,{
      enter:'pop',letterEnter:'rise',enterMs:480,
    });
    expect(row.dataset.enter).toBe('pop');
    expect(row.dataset.letterEnter).toBe('rise');
    expect(row.querySelectorAll('.overlay-letter').length).toBeGreaterThan(8);
    expect(row.style.getPropertyValue('--chat-enter-duration')).toBe('480ms');
  });
  it('keeps the row entrance for an overlong message that cannot be split into letters',()=>{
    const row=createChatMessageElement({...sample,parts:[{type:'text',text:'A'.repeat(600)}]},{
      enter:'slide-right',letterEnter:'wave',
    });
    expect(row.dataset.enter).toBe('slide-right');
    expect(row.querySelector('[data-letter-enter]')).toBeNull();
  });
  it('does not replace existing rows or reset lifetimes when entrance settings change',()=>{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{enter:'rise',letterEnter:'pop',ttlMs:120000});
    feed.receive(sample);
    const row=root.firstElementChild as HTMLElement;
    const time=feed.snapshot()[0]!.enteredAt;
    expect(row.dataset.enter).toBe('rise');
    expect(row.dataset.letterEnter).toBe('pop');
    feed.configure({enter:'scale',letterEnter:'fade'});
    // Already admitted rows retain their entrance until their lifetime ends.
    expect(root.firstElementChild).toBe(row);
    expect(feed.snapshot()[0]!.enteredAt).toBe(time);
    feed.dispose();
  });
});
