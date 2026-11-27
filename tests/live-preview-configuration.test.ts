import {describe,it,expect} from 'vitest';
import type {DisplayMessage} from '../src/chatbus';
import {createChatFeed,createEmoteWall} from '../src/views';
import {createAvatarWorld} from '../src/avatar-world';
import {createEventOverlay} from '../src/events';
import type {SocialSignalV1} from '@myrqyry/chatbus';

const message=(id='m1',user='moss'):DisplayMessage=>({
  id,timestamp:1000,platform:'kick',channelName:'garden',sourceId:'kick:garden',
  user:{id:user,username:user,name:user,badges:[]},parts:[{type:'text',text:'hello'}],
});
const signal:SocialSignalV1={schemaVersion:1,producer:'chatbus',source:{platform:'kick',channelName:'garden',origin:'live'},
  event:{type:'subscription',id:'s1',occurredAtMs:1000,receivedAtMs:1000},actor:{platform:'kick',username:'moss',displayName:'Moss'}};

describe('persistent preview renderer configuration',()=>{
  it('refreshes chat presentation on the same live row without resetting scene ownership',()=>{
    const root=document.createElement('div');document.body.append(root);
    const feed=createChatFeed(root,{fontSize:20,ttlMs:100000,enter:'rise'});
    feed.receive(message());
    const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
    const enteredAt=feed.snapshot()[0]!.enteredAt;
    feed.configure({fontSize:34,showNames:false,backgroundAlpha:35});
    feed.refreshAppearance();
    expect(root.querySelector('.overlay-chat-message')).toBe(row);
    expect(row.style.fontSize).toBe('34px');
    expect(row.querySelector('[data-username]')).toBeNull();
    expect(row.dataset.enter).toBe('none');
    expect(feed.snapshot()[0]!.enteredAt).toBe(enteredAt);
    feed.dispose();root.remove();
  });

  it('updates wall presentation without replacing its live entity',()=>{
    const root=document.createElement('div');document.body.append(root);
    const feed=createEmoteWall(root,{size:40,maxActive:4,ttlMs:100000});
    feed.receive({...message(),parts:[{type:'emote',emote:{id:'e',code:'E',url:'/assets/heart.svg',overlays:[],modifiers:[]}}]});
    const item=root.querySelector<HTMLElement>('.overlay-wall-item')!;
    feed.configure({size:72,motion:'bounce',wallDistance:42});
    expect(root.querySelector('.overlay-wall-item')).toBe(item);
    expect(item.style.height).toBe('72px');
    expect(item.dataset.motion).toBe('bounce');
    expect(item.style.getPropertyValue('--wall-distance')).toBe('42px');
    feed.dispose();root.remove();
  });

  it('reconfigures avatar population in place',()=>{
    const world=createAvatarWorld({maxActive:4,activity:'calm'});
    for(const [id,user] of [['1','a'],['2','b'],['3','c']])world.receive(message(id,user));
    world.configure({maxActive:2,activity:'playful'});
    expect(world.snapshot().map(actor=>actor.name)).toEqual(['b','c']);
    world.dispose();
  });

  it('updates event styling and trigger admission on the existing surface',()=>{
    const root=document.createElement('div');
    const overlay=createEventOverlay(root,{position:'center',style:'soft',enabled:{subscription:false}});
    const surface=root.querySelector<HTMLElement>('.overlay-events')!;
    overlay.receive(signal);
    expect(root.querySelector('.overlay-event-alert')).toBeNull();
    overlay.configure({position:'top',style:'paper',fontSize:48,enabled:{subscription:true}});
    overlay.receive({...signal,event:{...signal.event,id:'s2'}});
    expect(root.querySelector('.overlay-events')).toBe(surface);
    expect(surface.dataset.position).toBe('top');
    expect(surface.dataset.style).toBe('paper');
    expect(surface.style.getPropertyValue('--events-font')).toBe('48px');
    expect(root.querySelector('.overlay-event-alert')).not.toBeNull();
    overlay.dispose();
  });
});
