import { describe, expect, it } from 'vitest';
import type { DisplayMessage } from '../src/chatbus';
import { createAvatarWorld } from '../src/avatar-world';
import { avatarPlacement } from '../src/avatar-scene';
import { optionsForEditor, readOptions, writeOptions, normalizeOptions } from '../src/options';
import { restoreSeparateSettings } from '../src/editor-settings';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const message = (id:string,user:string,emote=false):DisplayMessage => ({
  id,timestamp:1,platform:'twitch',channelName:'garden',
  user:{id:user,username:user,name:user,badges:[]},
  parts:emote ? [{type:'emote',emote:{id:'heart',code:'heart',url:'/assets/heart.svg',overlays:[],modifiers:[]}}]
    : [{type:'text',text:'hello!'}],
});

describe('autonomous viewer world',()=>{
  it('spawns persistent, identifiable viewers, not one avatar per message',()=>{
    const world=createAvatarWorld({maxActive:2});
    world.receive(message('1','moss'));
    world.receive(message('2','moss'));
    world.receive(message('3','cat'));
    expect(world.snapshot().map(a=>a.name)).toEqual(['moss','cat']);
    world.receive(message('4','fox'));
    expect(world.snapshot().map(a=>a.name)).toEqual(['cat','fox']);
    world.dispose();
  });
  it('chooses autonomous activities and is deterministic for identical input and steps',()=>{
    const a=createAvatarWorld({activity:'playful'}), b=createAvatarWorld({activity:'playful'});
    for(const world of [a,b]){
      world.receive(message('1','moss'));
      world.receive(message('2','cat'));
      for(let i=0;i<360;i++)world.step(16);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().some(viewer=>viewer.activity!=='idle')).toBe(true);
    a.dispose(); b.dispose();
  });
  it('a triggered jump rises and lands, and never drifts upward indefinitely',()=>{
    const world=createAvatarWorld({activity:'playful'});
    world.receive(message('hop-1','moss',true));
    const heights:number[]=[];
    for(let i=0;i<95;i++){
      world.step(16);
      heights.push(world.snapshot()[0]!.hop);
    }
    expect(Math.max(...heights)).toBeGreaterThan(.02);
    expect(Math.max(...heights)).toBeLessThan(.2);
    expect(heights.at(-1)).toBe(0);
    for(let i=0;i<300;i++)world.step(16);
    expect(world.snapshot()[0]!.hop).toBeGreaterThanOrEqual(0);
    expect(world.snapshot()[0]!.hop).toBeLessThan(.2);
    world.dispose();
  });
  it('autonomous hop decisions also rise and return to ground',()=>{
    const world=createAvatarWorld({activity:'playful'});
    for(const [id,user] of [['1','moss'],['2','cat'],['3','fox']]){
      world.receive(message(id,user));
    }
    let maxHeight=0;
    for(let i=0;i<2000;i++){
      world.step(16);
      maxHeight=Math.max(maxHeight,...world.snapshot().map(actor=>actor.hop));
    }
    expect(maxHeight).toBeGreaterThan(.01);
    expect(maxHeight).toBeLessThan(.2);
    world.dispose();
  });
  it('reacts to an emote message, then removes the matching bubble on deletion',()=>{
    const world=createAvatarWorld();
    world.receive(message('emote-1','moss',true));
    expect(world.snapshot()[0]?.activity).toBe('hop');
    expect(world.snapshot()[0]?.thought).toBe('heart');
    world.removeMessage('emote-1');
    expect(world.snapshot()[0]?.thought).toBeNull();
    world.receive(message('emote-1','moss',true)); // late duplicate must not restore moderated text
    expect(world.snapshot()[0]?.thought).toBeNull();
    expect(world.snapshot()).toHaveLength(1);
    world.dispose();
  });
  it('moderation, clear, duplicate messages, and anonymous input are bounded',()=>{
    const world=createAvatarWorld();
    world.receive(message('1','moss'));
    world.receive(message('1','moss'));
    world.receive({...message('2','someone'),user:{name:'',badges:[]}});
    expect(world.snapshot()).toHaveLength(1);
    world.removeUser({username:'moss'});
    expect(world.snapshot()).toHaveLength(0);
    world.receive(message('3','cat'));
    world.clear();
    expect(world.snapshot()).toHaveLength(0);
    world.dispose();
  });
  it('keeps moderation and source clears inside one service when identities overlap',()=>{
    const world=createAvatarWorld();
    world.receive({...message('t1','same'),sourceId:'twitch:garden'});
    world.receive({...message('y1','same'),sourceId:'youtube:video',platform:'youtube',channelName:'video'});
    expect(world.snapshot()).toHaveLength(2);
    world.removeUser({sourceId:'youtube:video',username:'same'});
    expect(world.snapshot()).toMatchObject([{sourceId:'twitch:garden'}]);
    world.removeSource('twitch:garden');
    expect(world.snapshot()).toHaveLength(0);
    world.dispose();
  });
});

describe('avatar workspace integration contract',()=>{
  it('has independent, round-tripping settings and preserves older workspace values',()=>{
    const options=normalizeOptions({avatarsMax:18,avatarSize:70,avatarActivity:'playful',avatarNames:false});
    const url=writeOptions(options,'avatars');
    expect(url).toContain('avatarsMax=18');
    expect(url).not.toContain('wallMax=');
    expect(readOptions('?'+url,'avatars').avatarsMax).toBe(18);
    expect(readOptions('?'+url,'avatars').avatarNames).toBe(false);
    expect(optionsForEditor('avatars',true).map(d=>d.key)).toEqual(expect.arrayContaining(['avatarsMax','avatarSize','avatarActivity','avatarNames']));
    const recovered=restoreSeparateSettings(null,{chat:{font:35},wall:{wallMax:11}},'');
    expect(recovered.chat.font).toBe(35);
    expect(recovered.wall.wallMax).toBe(11);
    expect(recovered.avatars.avatarsMax).toBeGreaterThan(0);
  });
  it('offers a third accessible tab, standalone source, and real preview',()=>{
    const markup=readFileSync(resolve(process.cwd(),'index.html'),'utf8');
    const doc=new DOMParser().parseFromString(markup,'text/html');
    expect(Array.from(doc.querySelectorAll('.workspace-tabs [role=tab]')).map(el=>el.id))
      .toEqual(['edit-wall','edit-chat','edit-avatars','edit-events']);
    expect(doc.querySelector('#avatars-preview')).not.toBeNull();
    expect(doc.querySelector('#avatars-url')?.getAttribute('href')).toBe('avatars.html');
    expect(readFileSync(resolve(process.cwd(),'avatars.html'),'utf8')).toContain('data-view="avatars"');
  });
});

describe('avatar canvas containment',()=>{
  it('keeps a large avatar, its bubble and name inside narrow and short preview canvases',()=>{
    for(const [width,height] of [[120,90],[180,70],[100,160],[320,96]]){
      for(const x of [.02,.5,.98]){
        const layout=avatarPlacement({x},{width,height},{size:110,showNames:true});
        expect(layout.x - layout.size*1.06).toBeGreaterThanOrEqual(-.001);
        expect(layout.x + layout.size*1.06).toBeLessThanOrEqual(width+.001);
        expect(layout.ground+30).toBeLessThanOrEqual(height);
        expect(layout.ground-layout.size*1.55).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
