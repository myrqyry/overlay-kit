import { describe, expect, it } from 'vitest';
import { applyChatStylePack, getChatStylePack, listChatStylePacks, registerChatStylePack } from '../src/style-packs';
import { createChatFeed } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, optionsForEditor } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const message:DisplayMessage={id:'test-one',timestamp:1000,user:{name:'Artist',badges:[]},parts:[{type:'text',text:'Hello world'}]};

describe('reusable chat style packs',()=>{
  it('ships plain, paper, and phosphor manifests with stable IDs',()=>{
    const styles=listChatStylePacks();
    expect(styles.map(x=>x.id)).toEqual(['plain','paper','phosphor']);
    expect(styles.every(x=>x.name.length>0&&x.description.length>0)).toBe(true);
    expect(getChatStylePack('paper')?.id).toBe('paper');
    expect(getChatStylePack('javascript:alert(1)')).toBeUndefined();
  });
  it('can install, switch and clean up a trusted style without touching chat markup',()=>{
    const root=document.createElement('div');
    const original=document.createElement('div');
    original.className='overlay-chat-message';
    root.append(original);
    const a=applyChatStylePack(root,'paper');
    expect(root.dataset.chatStyle).toBe('paper');
    expect(root.querySelector('.overlay-chat-message')).toBe(original);
    a.dispose();
    expect(root.dataset.chatStyle).toBeUndefined();
    const b=applyChatStylePack(root,'phosphor');
    expect(root.dataset.chatStyle).toBe('phosphor');
    b.dispose();
    expect(root.dataset.chatStyle).toBeUndefined();
  });
  it('accepts a trusted plugin registration with a bounded lifecycle and rejects duplicate/unsafe names',()=>{
    const root=document.createElement('div');
    let mounted=0,cleaned=0;
    const unregister=registerChatStylePack({
      id:'test-canvas',name:'Canvas',description:'Test style',
      mount:()=>{mounted++;return ()=>{cleaned++;};},
    });
    expect(getChatStylePack('test-canvas')?.name).toBe('Canvas');
    expect(()=>registerChatStylePack({id:'test-canvas',name:'Duplicate',description:'x'})).toThrow();
    expect(()=>registerChatStylePack({id:'not safe!x',name:'Unsafe',description:'x'})).toThrow();
    const active=applyChatStylePack(root,'test-canvas');
    expect(root.dataset.chatStyle).toBe('test-canvas');
    active.dispose();
    active.dispose();
    expect([mounted,cleaned]).toEqual([1,1]);
    unregister();
    expect(getChatStylePack('test-canvas')).toBeUndefined();
  });
  it('persists a selected style in the editor and OBS source URL with a safe default',()=>{
    expect(DEFAULT_OPTIONS.chatStyle).toBe('plain');
    expect(optionsForEditor('chat',false).find(x=>x.key==='chatStyle')?.choices?.map(x=>x.value))
      .toEqual(['plain','paper','phosphor']);
    expect(optionsForEditor('wall',true).some(x=>x.key==='chatStyle')).toBe(false);
    for(const chatStyle of ['paper','phosphor'] as const){
      const options=normalizeOptions({chatStyle});
      const url=writeOptions(options,'chat');
      expect(url).toContain('style='+chatStyle);
      expect(readOptions('?'+url,'chat').chatStyle).toBe(chatStyle);
      expect(writeOptions(options,'wall')).not.toContain('style=');
    }
    expect(normalizeOptions({chatStyle:'javascript:alert(1)'}).chatStyle).toBe('plain');
  });
  it('switches styles in the same live chat feed without restarting lifecycle or erasing messages',()=>{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{stylePack:'plain',ttlMs:60000,maxActive:4});
    feed.receive(message);
    const before=root.querySelector('.overlay-chat-message');
    expect(root.dataset.chatStyle).toBe('plain');
    feed.configure({stylePack:'paper'});
    expect(root.dataset.chatStyle).toBe('paper');
    expect(root.querySelector('.overlay-chat-message')).toBe(before);
    expect(feed.snapshot()).toHaveLength(1);
    feed.configure({stylePack:'phosphor'});
    expect(root.dataset.chatStyle).toBe('phosphor');
    expect(root.querySelector('.overlay-chat-message')).toBe(before);
    feed.dispose();
    expect(root.dataset.chatStyle).toBeUndefined();
    expect(root.childElementCount).toBe(0);
  });
});
