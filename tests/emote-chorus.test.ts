import {describe,it,expect} from 'vitest';
import {createEmoteChorusDetector} from '../src/emote-chorus';
import {createEmoteWall} from '../src/views';
import {DEFAULT_OPTIONS,readOptions,writeOptions,normalizeOptions,optionsForEditor} from '../src/options';
import type {DisplayMessage,EmoteArtwork} from '../src/chatbus';

const art=(id='heart'):EmoteArtwork=>({id,provider:'7tv',code:id,url:'/assets/'+id+'.svg',overlays:[],modifiers:[]});
const msg=(id:string,user:string,emote='heart',channel='room'):DisplayMessage=>({
  id,timestamp:42,platform:'twitch',channelName:channel,
  user:{name:user,username:user,id:'user-'+user,badges:[]},
  parts:[{type:'emote',emote:art(emote)}],
});
const event=(message:DisplayMessage)=>({type:'message' as const,message});

describe('bounded emote chorus recognition',()=>{
  it('recognizes three distinct users and does not count duplicate transport messages or repeat authors',()=>{
    let time=1000;
    const detector=createEmoteChorusDetector({now:()=>time,participants:3,windowMs:20000});
    expect(detector.observe(event(msg('1','one')))).toBeNull();
    expect(detector.observe(event(msg('1','one')))).toBeNull();
    expect(detector.observe(event(msg('2','one')))).toBeNull();
    expect(detector.observe(event(msg('3','two')))).toBeNull();
    expect(detector.observe(event(msg('4','three')))).toMatchObject({
      participants:3, art:{id:'heart'},message:{id:'4'},
    });
    expect(detector.observe(event(msg('5','four')))).toBeNull();
    time+=12000;
    expect(detector.observe(event(msg('6','five')))?.participants).toBe(5);
  });

  it('isolates providers/channels and ignores text-only or missing author identity',()=>{
    const detector=createEmoteChorusDetector({participants:2});
    expect(detector.observe(event(msg('1','a','heart','first')))).toBeNull();
    expect(detector.observe(event(msg('2','b','heart','second')))).toBeNull();
    expect(detector.observe(event({...msg('3','b'),parts:[{type:'text',text:'heart'}]}))).toBeNull();
    expect(detector.observe(event({...msg('4','c'),user:{name:'anon',badges:[]}}))).toBeNull();
    expect(detector.observe(event(msg('5','b','heart','first')))?.art.id).toBe('heart');
  });

  it('forgets moderated authors and deleted contributing messages without emitting fake cues',()=>{
    const detector=createEmoteChorusDetector({participants:3});
    detector.observe(event(msg('1','one')));
    detector.observe(event(msg('2','two')));
    expect(detector.observe({type:'delete',messageId:'2'})).toBeNull();
    expect(detector.observe(event(msg('3','three')))).toBeNull();
    expect(detector.observe({type:'user-clear',userId:'user-one'})).toBeNull();
    expect(detector.observe(event(msg('4','four')))).toBeNull();
    expect(detector.observe(event(msg('5','five')))?.participants).toBe(3);
    detector.observe({type:'clear'});
    expect(detector.observe(event(msg('6','six')))).toBeNull();
  });

  it('expires old contributors deterministically',()=>{
    let now=0;
    const detector=createEmoteChorusDetector({participants:2,windowMs:1000,now:()=>now});
    detector.observe(event(msg('1','one')));
    now=1001;
    expect(detector.observe(event(msg('2','two')))).toBeNull();
    expect(detector.observe(event(msg('3','three')))?.participants).toBe(2);
  });

  it('retains a running cooldown even after its contribution bucket is evicted',()=>{
    let now=1000;
    const detector=createEmoteChorusDetector({participants:3,windowMs:8000,cooldownMs:12000,now:()=>now});
    detector.observe(event(msg('original-1','a','heart')));
    detector.observe(event(msg('original-2','b','heart')));
    expect(detector.observe(event(msg('original-3','c','heart')))).not.toBeNull();
    // 128 other distinct emotes exhaust the bucket cap and evict the heart bucket.
    for(let i=0;i<128;i++){
      detector.observe(event(msg('filler-'+i,'other','other-'+i)));
    }
    detector.observe(event(msg('early-1','one','heart')));
    detector.observe(event(msg('early-2','two','heart')));
    expect(detector.observe(event(msg('early-3','three','heart')))).toBeNull();
    now+=12001;
    detector.observe(event(msg('late-1','one','heart')));
    detector.observe(event(msg('late-2','two','heart')));
    expect(detector.observe(event(msg('late-3','three','heart')))).not.toBeNull();
  });

  it('rejects unsupported thresholds',()=>{
    expect(()=>createEmoteChorusDetector({participants:1})).toThrow();
    expect(()=>createEmoteChorusDetector({windowMs:0})).toThrow();
  });
});

describe('opt-in wall chorus settings',()=>{
  it('defaults off and round-trips only in wall URLs',()=>{
    expect(DEFAULT_OPTIONS.wallChorus).toBe(false);
    const wall=optionsForEditor('wall',false);
    expect(wall.some(option=>option.key==='wallChorus')).toBe(true);
    const query=writeOptions(normalizeOptions({wallChorus:true}),'wall');
    expect(query).toContain('chorus=1');
    expect(readOptions('?'+query,'wall').wallChorus).toBe(true);
    expect(writeOptions(normalizeOptions({wallChorus:true}),'chat')).not.toContain('chorus');
  });
});

describe('visual chorus response',()=>{
  it('uses the existing scene without altering source messages and cleans up under moderation',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:12,ttlMs:120000,motion:'still'});
    const source=msg('trigger','three');
    expect(wall.receive(source)).toBe(1);
    expect(wall.reactToChant(source,art(),6)).toBe(6);
    expect(wall.snapshot()).toHaveLength(7);
    expect(root.querySelectorAll('[data-wall-chorus]')).toHaveLength(6);
    expect(source.parts).toHaveLength(1);
    wall.removeMessage('trigger');
    expect(wall.snapshot()).toHaveLength(0);
    wall.dispose();
    expect(root.childElementCount).toBe(0);
  });

  it('caps bursts and obeys ordinary wall capacity',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:3,ttlMs:120000,motion:'still'});
    const source=msg('trigger','u');
    expect(wall.reactToChant(source,art(),999)).toBeLessThanOrEqual(6);
    expect(wall.snapshot().length).toBeLessThanOrEqual(3);
    wall.clear();
    expect(wall.snapshot()).toHaveLength(0);
    wall.dispose();
  });
});
