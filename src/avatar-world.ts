import type { DisplayMessage } from './chatbus';

export type AvatarActivity = 'idle' | 'wander' | 'rest' | 'hop' | 'greet';
export interface ViewerAvatar {
  id: string; name: string; username: string; userId?: string; sourceId?:string; color: string;
  x: number; face: -1 | 1; hop: number; activity: AvatarActivity;
  thought: string | null; thoughtId: string | null; thoughtUntil: number;
}
export interface AvatarWorldOptions {
  maxActive?: number;
  activity?: 'calm' | 'playful';
}
interface Actor extends ViewerAvatar {
  seed: number; vx: number; vy: number; until: number; target: number;
}
const palette = ['#9fd9c7','#e7afba','#e9cf9d','#b8abe2','#b6d8ef','#daa8cb'];
const clamp = (x:number,min:number,max:number) => Math.max(min,Math.min(max,x));
function hash(value:string) {
  let h=2166136261;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);
  return h>>>0;
}
function rand(actor:Actor):number {
  actor.seed = (Math.imul(actor.seed,1664525)+1013904223)>>>0;
  return actor.seed / 4294967296;
}
function identity(message:DisplayMessage) {
  const name=(message.user.name||'').trim().slice(0,48);
  const username=(message.user.username||name).trim().toLowerCase().slice(0,48);
  const userId=message.user.id?.trim();
  if(!name||(!username&&!userId))return null;
  const id=[message.platform||'unknown',message.channelName||'default',userId?('id:'+userId):('name:'+username)].join(':');
  return {id,name,username,userId,sourceId:message.sourceId};
}
export function createAvatarWorld(options:AvatarWorldOptions={}) {
  const actors=new Map<string,Actor>();
  const seen=new Map<string,string>();
  let max=clamp(Math.floor(options.maxActive??24),1,80);
  let activity=options.activity??'calm';
  let time=0, disposed=false;
  function choose(actor:Actor) {
    const chance=rand(actor), playful=activity==='playful';
    if(chance < (playful?.18:.33)) {
      actor.activity='rest'; actor.vx=0;
    } else if(chance < (playful?.38:.48)) {
      actor.activity='hop'; actor.vy=.44; actor.vx=(rand(actor)-.5)*.11;
    } else if(chance < (playful?.64:.61) && actors.size>1) {
      const neighbor=[...actors.values()].filter(other=>other!==actor)
        .sort((a,b)=>Math.abs(a.x-actor.x)-Math.abs(b.x-actor.x))[0]!;
      actor.activity='greet'; actor.target=clamp(neighbor.x+(actor.x<neighbor.x?-.055:.055),.05,.95);
    } else {
      actor.activity='wander'; actor.target=.06+rand(actor)*.88;
    }
    actor.until=time+(playful?700:1000)+rand(actor)*(playful?1400:2600);
  }
  function receive(message:DisplayMessage) {
    if(disposed||!message.id||seen.has(message.id))return;
    const viewer=identity(message);
    if(!viewer)return;
    seen.set(message.id,viewer.id);
    if(seen.size>512)seen.delete(seen.keys().next().value!);
    let actor=actors.get(viewer.id);
    if(!actor) {
      if(actors.size>=max)actors.delete(actors.keys().next().value!);
      const seed=hash(viewer.id);
      actor={...viewer,color:palette[seed%palette.length]!,x:.08+(seed%831)/1000*.84,
        face:1,hop:0,activity:'idle',thought:null,thoughtId:null,thoughtUntil:0,
        seed,vx:0,vy:0,until:time+300+(seed%1100),target:.5};
      actors.set(viewer.id,actor);
    } else {
      actor.name=viewer.name;
      // Recently active avatars remain present when the scene fills.
      actors.delete(viewer.id); actors.set(viewer.id,actor);
    }
    const emote=message.parts.find(p=>p.type==='emote');
    if(emote?.type==='emote'){
      actor.thought=emote.emote.code.slice(0,24);
      actor.thoughtId=message.id;
      actor.thoughtUntil=time+2500;
      actor.activity='hop'; actor.vy=.46;
      actor.until=time+850;
    } else {
      actor.activity='greet';
      const others=[...actors.values()].filter(other=>other!==actor);
      if(others.length){
        const neighbor=others.reduce((a,b)=>Math.abs(a.x-actor!.x)<Math.abs(b.x-actor!.x)?a:b);
        actor.target=clamp(neighbor.x+(actor.x<neighbor.x?-.06:.06),.04,.96);
      }else actor.target=clamp(actor.x+(rand(actor)-.5)*.3,.04,.96);
      actor.until=time+1200;
    }
  }
  function step(deltaMs:number) {
    if(disposed||!Number.isFinite(deltaMs)||deltaMs<=0)return;
    const dt=Math.min(deltaMs,50)/1000;
    time+=dt*1000;
    for(const actor of actors.values()) {
      if(time>=actor.thoughtUntil){actor.thought=null;actor.thoughtId=null;}
      if(time>=actor.until)choose(actor);
      if(actor.activity==='wander'||actor.activity==='greet') {
        const dx=actor.target-actor.x;
        if(Math.abs(dx)<.008){actor.activity='idle';actor.vx=0;}
        else {actor.face=dx>0?1:-1;actor.vx=clamp(dx*1.5,-.095,.095)*(activity==='playful'?1.6:1);
          actor.x=clamp(actor.x+actor.vx*dt,.03,.97);}
      } else actor.vx*=.8;
      if(actor.activity==='hop'&&actor.hop===0&&actor.vy===0)actor.vy=.42;
      if(actor.hop>0||actor.vy!==0){
        // Positive height and velocity mean upward motion; gravity reduces velocity.
        actor.hop+=actor.vy*dt;
        actor.vy-=1.65*dt;
        if(actor.hop<=0){
          actor.hop=0; actor.vy=0;
          // A completed hop must not relaunch itself every frame.
          if(actor.activity==='hop')actor.activity='idle';
        }
      }
    }
    // Gentle crowd spacing so characters can meet without piling up.
    const list=[...actors.values()];
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i]!,b=list[j]!,dx=b.x-a.x;
      if(Math.abs(dx)<.029){
        const shift=(.029-Math.abs(dx))*.025;
        const direction=dx===0?(a.seed<b.seed?1:-1):Math.sign(dx);
        a.x=clamp(a.x-direction*shift,.02,.98);
        b.x=clamp(b.x+direction*shift,.02,.98);
      }
    }
  }
  return {
    receive,
    step,
    snapshot:():ViewerAvatar[]=>[...actors.values()].map(({id,name,username,userId,sourceId,color,x,face,hop,activity,thought,thoughtId,thoughtUntil})=>
      ({id,name,username,userId,sourceId,color,x,face,hop,activity,thought,thoughtId,thoughtUntil})),
    removeMessage(id:string){ const viewer=seen.get(id);
      // Keep the bounded deduplication tombstone so late replays cannot restore moderated text.
      const actor=viewer?actors.get(viewer):undefined;
      if(actor?.thoughtId===id){actor.thought=null;actor.thoughtId=null;}
    },
    removeUser(target:{sourceId?:string;userId?:string;username?:string}){
      if(!target.userId&&!target.username)return;
      for(const [id,actor] of actors){
        if(target.sourceId&&actor.sourceId!==target.sourceId)continue;
        if(target.userId&&target.userId===actor.userId||target.username&&target.username.toLowerCase()===actor.username)
          actors.delete(id);
      }
    },
    removeSource(sourceId:string){
      for(const [id,actor] of actors)if(actor.sourceId===sourceId)actors.delete(id);
    },
    configure(patch:AvatarWorldOptions){
      if(patch.maxActive!==undefined){
        max=clamp(Math.floor(patch.maxActive),1,80);
        while(actors.size>max)actors.delete(actors.keys().next().value!);
      }
      if(patch.activity!==undefined)activity=patch.activity;
    },
    clear(){actors.clear();seen.clear();time=0;},
    dispose(){disposed=true;actors.clear();seen.clear();},
  };
}
