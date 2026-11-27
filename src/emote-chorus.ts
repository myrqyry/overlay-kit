import type {DisplayMessage, EmoteArtwork} from './chatbus';
import type {OverlayLiveEvent} from './live';

/** Session-local presentation cue; does not modify, suppress, or invent chat events. */
export interface EmoteChorusCue {
  message: DisplayMessage;
  art: EmoteArtwork;
  participants: number;
}
export interface EmoteChorusSettings {
  /** Distinct viewers needed to trigger, default 3. */
  participants?: number;
  /** Rolling window, default 8000ms. */
  windowMs?: number;
  /** Minimum time between visual bursts per emote, default 12000ms. */
  cooldownMs?: number;
  now?: () => number;
}
interface Contribution { messageId:string; userId?:string; username?:string; at:number; }
/** Bounded emote-by-emote recognition using transport-normalized messages. */
export function createEmoteChorusDetector(options:EmoteChorusSettings={}) {
  const needed=options.participants??3;
  const windowMs=options.windowMs??8000;
  const cooldownMs=options.cooldownMs??12000;
  if(!Number.isSafeInteger(needed)||needed<2||needed>20)throw new RangeError('participants must be 2–20');
  if(!Number.isFinite(windowMs)||windowMs<100||windowMs>60000)throw new RangeError('windowMs must be 100–60000');
  if(!Number.isFinite(cooldownMs)||cooldownMs<0||cooldownMs>120000)throw new RangeError('cooldownMs must be 0–120000');
  const clock=options.now??Date.now;
  const MAX_BUCKETS=128;
  const MAX_SEEN=512;
  // Independent of contribution buckets: eviction must not bypass a running cooldown.
  const MAX_COOLDOWNS=512;
  const buckets=new Map<string, Map<string, Contribution>>();
  const lastCue=new Map<string,number>();
  const seen=new Map<string,number>();
  const reset=()=>{buckets.clear();lastCue.clear();seen.clear();};
  const prune=(now:number)=>{
    for(const [key,people] of buckets) {
      for(const [identity,entry] of people)
        if(now-entry.at>windowMs)people.delete(identity);
      if(!people.size)buckets.delete(key);
    }
    for(const [id,at] of seen)if(now-at>windowMs)seen.delete(id);
    for(const [key,at] of lastCue)if(now-at>cooldownMs)lastCue.delete(key);
  };
  const forget=(matches:(entry:Contribution)=>boolean)=>{
    for(const [key,people] of buckets){
      for(const [identity,entry] of people)if(matches(entry))people.delete(identity);
      if(!people.size)buckets.delete(key);
    }
  };
  return {
    observe(event:OverlayLiveEvent):EmoteChorusCue|null {
      if(event.type==='clear'){reset();return null;}
      if(event.type==='delete'){forget(entry=>entry.messageId===event.messageId);return null;}
      if(event.type==='user-clear'){
        forget(entry=>Boolean((event.userId&&entry.userId===event.userId)
          ||(event.username&&entry.username?.toLowerCase()===event.username.toLowerCase())));
        return null;
      }
      if(event.type!=='message')return null;
      const msg=event.message;
      const now=clock();
      prune(now);
      // Identity must come from the platform, not a display-name or message-ID guess.
      const author=msg.user.id? 'id:'+msg.user.id : msg.user.username?
        'login:'+msg.user.username.toLowerCase():null;
      if(!author||seen.has(msg.id))return null;
      seen.set(msg.id,now);
      while(seen.size>MAX_SEEN)seen.delete(seen.keys().next().value!);
      const unique=new Map<string,EmoteArtwork>();
      for(const part of msg.parts){
        if(part.type!=='emote')continue;
        const art=part.emote;
        if(!art.id||!art.url)continue;
        const key=JSON.stringify([msg.platform??'',msg.channelName??'',art.provider??'',art.id]);
        unique.set(key,art);
      }
      for(const [key,art] of unique){
        let people=buckets.get(key);
        if(!people){
          if(buckets.size>=MAX_BUCKETS){
            const oldest=buckets.keys().next().value;
            if(oldest!==undefined)buckets.delete(oldest);
          }
          people=new Map();
          buckets.set(key,people);
        }
        people.set(author,{messageId:msg.id,at:now,...(msg.user.id?{userId:msg.user.id}:{}),
          ...(msg.user.username?{username:msg.user.username}:{})});
        if(people.size>=needed && (!lastCue.has(key)||now-lastCue.get(key)!>=cooldownMs)){
          lastCue.set(key,now);
          while(lastCue.size>MAX_COOLDOWNS)lastCue.delete(lastCue.keys().next().value!);
          return {message:msg,art,participants:people.size};
        }
      }
      return null;
    },
    reset,
  };
}
