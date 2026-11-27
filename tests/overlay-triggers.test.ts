import {describe,expect,it,vi} from 'vitest';
import {parseTriggerRules,createTriggerDirector,serializeTriggerRules} from '../src/overlay-triggers';
import type {DisplayMessage} from '../src/chatbus';
import type {SocialSignalV1} from '@myrqyry/chatbus';
const message=(id:string,text:string,roles:string[]=['moderator'],sourceId='twitch:room'):DisplayMessage=>({
 id,timestamp:Date.now(),sourceId,user:{id:'alice',username:'alice',name:'Alice',roles,badges:[]},
 parts:[{type:'text',text}],
});
const signal=(id:string,type:SocialSignalV1['event']['type'],origin:'live'|'replay'|'test'='live'):SocialSignalV1=>({
 schemaVersion:1,producer:'chatbus',source:{platform:'twitch',channelName:'room',origin},
 event:{type,id,occurredAtMs:Date.now(),receivedAtMs:Date.now()},
});
describe('channel event and command overlay trigger rules',()=>{
 it('parses supported actions into compact, bounded view-specific rules',()=>{
   const wall=parseTriggerRules('!hype -> confetti @mods 6s\nraid -> spotlight 8s\nsubscription -> holo-foil 7s\n!retro -> phosphor @any 5s','wall');
   expect(wall.rules).toHaveLength(3);
   expect(wall.errors).toHaveLength(1);
   expect(wall.rules[0]).toMatchObject({kind:'command',key:'!hype',effect:'confetti',access:'mods',durationMs:6000});
   expect(wall.rules[2]).toMatchObject({kind:'event',key:'subscription',effect:'holo-foil'});
   expect(serializeTriggerRules('!hype -> confetti @mods 6s\ninvalid\nraid -> spotlight 8s','wall')).toBe('!hype -> confetti @mods 6s\nraid -> spotlight 8s');
   expect(parseTriggerRules('!paper -> paper @mods 7s','chat').rules).toHaveLength(1);
   expect(parseTriggerRules('!paper -> paper @mods 7s','wall').rules).toHaveLength(0);
 });
 it('admits only exact initial command tokens, default mod/broadcaster roles, with any explicit',()=>{
   vi.useFakeTimers();
   try{
     const changes:unknown[]=[];
     const director=createTriggerDirector('chat','!hype -> confetti 5s\n!dance -> pulse @any 4s',{onChange:c=>changes.push(c)});
     expect(director.receiveMessage(message('a','I say !hype'))).toBe(false);
     expect(director.receiveMessage(message('b','!hype!',[]))).toBe(false);
     expect(director.receiveMessage(message('c','!hype',[]))).toBe(false);
     expect(director.receiveMessage(message('d','!hype yep',['moderator']))).toBe(true);
     expect(director.active()?.effect).toBe('confetti');
     expect(director.receiveMessage(message('e','!dance',[]))).toBe(true);
     expect(director.active()?.effect).toBe('pulse');
     vi.advanceTimersByTime(4000);
     expect(director.active()).toBeNull();
     expect(changes.at(-1)).toBeNull();
     director.dispose();
     expect(vi.getTimerCount()).toBe(0);
   }finally{vi.useRealTimers();}
 });
 it('deduplicates replays and uses a per-rule cooldown, preserving other events',()=>{
   vi.useFakeTimers();
   try{
     const director=createTriggerDirector('wall','!hype -> confetti @any 4s\nraid -> spotlight 8s');
     expect(director.receiveMessage(message('a','!hype',[]))).toBe(true);
     expect(director.receiveMessage(message('a','!hype',[]))).toBe(false);
     expect(director.receiveMessage(message('b','!hype',[]))).toBe(false);
     expect(director.receiveSignal(signal('r','raid'))).toBe(true);
     expect(director.receiveSignal(signal('r','raid'))).toBe(false);
     expect(director.receiveSignal(signal('x','raid','replay'))).toBe(false);
     vi.advanceTimersByTime(8100);
     expect(director.active()).toBeNull();
     expect(director.receiveMessage(message('c','!hype',[]))).toBe(true);
     director.dispose();
   }finally{vi.useRealTimers();}
 });
 it('accepts id-less live channel events by their source/actor/time fingerprint once',()=>{
   vi.useFakeTimers();
   try{
     const director=createTriggerDirector('wall','follow -> rain 5s');
     const withoutId={...signal('unused','follow'),event:{
       type:'follow' as const,occurredAtMs:1234,receivedAtMs:5678,
     },actor:{platform:'twitch' as const,username:'new_follower',displayName:'New Follower'}};
     expect(director.receiveSignal(withoutId)).toBe(true);
     expect(director.receiveSignal({...withoutId,event:{...withoutId.event,receivedAtMs:9999}})).toBe(false);
     expect(director.active()?.effect).toBe('rain');
     vi.advanceTimersByTime(5100);
     expect(director.active()).toBeNull();
     director.dispose();
   }finally{vi.useRealTimers();}
 });
 it('reconfigures, clears and disposes without leaving timers or active visuals',()=>{
   vi.useFakeTimers();
   try{
     const results:(string|null)[]=[];
     const director=createTriggerDirector('chat','raid -> spotlight 8s',{onChange:cue=>results.push(cue?.effect??null)});
     expect(director.receiveSignal(signal('r','raid'))).toBe(true);
     director.configure('!retro -> phosphor @mods 6s');
     expect(director.active()).toBeNull();
     expect(results.at(-1)).toBeNull();
     expect(director.receiveSignal(signal('r2','raid'))).toBe(false);
     expect(director.receiveMessage(message('x','!retro'))).toBe(true);
     director.clear();
     expect(director.active()).toBeNull();
     director.dispose();
     expect(director.receiveMessage(message('y','!retro'))).toBe(false);
     vi.runAllTimers();
     expect(vi.getTimerCount()).toBe(0);
   }finally{vi.useRealTimers();}
 });
});
