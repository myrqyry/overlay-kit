import type {SocialSignalV1} from '@myrqyry/chatbus';
import type {DisplayMessage} from './chatbus';

export type TriggerView='wall'|'chat';
export type TriggerEffect=
  'pulse'|'confetti'|'glitch'|'spotlight'|'rain'|
  'paper'|'phosphor'|'holo-foil'|'ink-wash'|'bounce';
export type TriggerAccess='mods'|'broadcaster'|'any';
export interface TriggerRule {
  kind:'command'|'event';
  key:string;
  effect:TriggerEffect;
  access:TriggerAccess;
  durationMs:number;
}
export interface TriggerCue {
  effect:TriggerEffect;
  label:string;
  key:string;
  durationMs:number;
}
const EVENTS=new Set(['follow','raid','subscription','gift-subscription','cheer','donation','reward-redemption']);
const EFFECTS=new Set<TriggerEffect>(['pulse','confetti','glitch','spotlight','rain','paper','phosphor','holo-foil','ink-wash','bounce']);
const WALL_ONLY=new Set<TriggerEffect>(['holo-foil','ink-wash','bounce']);
const CHAT_ONLY=new Set<TriggerEffect>(['paper','phosphor']);
const MAX_RULES=12;
const roleAllowed=(message:DisplayMessage,access:TriggerAccess)=>{
  if(access==='any')return true;
  const roles=(message.user.roles??[]).map(role=>role.toLowerCase());
  const isBroadcaster=roles.some(role=>['broadcaster','owner','streamer'].includes(role));
  return isBroadcaster||(access==='mods'&&roles.some(role=>['moderator','mod'].includes(role)));
};
const sourceOfMessage=(message:DisplayMessage)=>
  message.sourceId??(message.platform??'unknown')+':'+(message.channelName??'unknown');
const sourceOfSignal=(signal:SocialSignalV1)=>
  signal.source.platform+':'+(signal.source.channelId??signal.source.channelName??'unknown');
const labelSafe=(value:string|undefined)=>
  (value??'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,32);
const lineFor=(rule:TriggerRule):string=>
  rule.key+' -> '+rule.effect+
  (rule.kind==='command'?' @'+rule.access:'')+
  ' '+Math.floor(rule.durationMs/1000)+'s';

export function parseTriggerRules(input:unknown,view:TriggerView):{rules:TriggerRule[];errors:string[]} {
  const rules:TriggerRule[]=[];
  const errors:string[]=[];
  if(typeof input!=='string'||!input.trim())return {rules,errors};
  const lines=input.slice(0,2500).split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!.trim();
    if(!line||line.startsWith('#'))continue;
    if(rules.length===MAX_RULES){errors.push('Maximum '+MAX_RULES+' rules');break;}
    const parts=/^(![a-z][a-z0-9_-]{0,23}|[a-z-]+)\s*->\s*([a-z-]+)(?:\s+@(mods|broadcaster|any))?(?:\s+(\d{1,2})s)?$/i.exec(line);
    if(!parts){errors.push('Line '+(i+1)+': invalid syntax');continue;}
    const key=parts[1]!.toLowerCase(),effect=parts[2]!.toLowerCase() as TriggerEffect;
    const kind=key.startsWith('!')?'command':'event';
    if((kind==='event'&&!EVENTS.has(key))||!EFFECTS.has(effect)||
      (view==='chat'&&WALL_ONLY.has(effect))||(view==='wall'&&CHAT_ONLY.has(effect))||
      (kind==='event'&&parts[3]!==undefined)){
      errors.push('Line '+(i+1)+': unsupported event, effect, or permission');continue;
    }
    const seconds=parts[4]===undefined?6:Number(parts[4]);
    if(seconds<2||seconds>12){errors.push('Line '+(i+1)+': duration must be 2–12s');continue;}
    rules.push({kind,key,effect,access:(parts[3] as TriggerAccess|undefined)??'mods',durationMs:seconds*1000});
  }
  return {rules,errors};
}
/** Opt-in examples; no real chat effects run until a user loads/saves them. */
export const starterTriggerRules=(view:TriggerView):string=>view==='wall'
  ? '!hype -> confetti @mods 6s\nraid -> spotlight 8s\nsubscription -> holo-foil 7s\n!bounce -> bounce @mods 6s'
  : '!hype -> confetti @mods 6s\nraid -> spotlight 8s\n!retro -> phosphor @mods 7s\nsubscription -> pulse 5s';

export const serializeTriggerRules=(input:unknown,view:TriggerView):string=>
  parseTriggerRules(input,view).rules.map(lineFor).join('\n');

export function createTriggerDirector(
  view:TriggerView,
  text='',
  hooks:{onChange?:(cue:TriggerCue|null)=>void;now?:()=>number}={},
) {
  let rules=parseTriggerRules(text,view).rules;
  const now=hooks.now??Date.now;
  const seen=new Set<string>();
  const seenOrder:string[]=[];
  const lastFired=new Map<string,number>();
  let cue:TriggerCue|null=null;
  let timeout:ReturnType<typeof setTimeout>|null=null;
  let disposed=false;
  const remember=(key:string)=>{
    if(seen.has(key))return false;
    seen.add(key);seenOrder.push(key);
    if(seenOrder.length>512)seen.delete(seenOrder.shift()!);
    return true;
  };
  const end=()=>{
    if(timeout!==null){clearTimeout(timeout);timeout=null;}
    if(cue){cue=null;hooks.onChange?.(null);}
  };
  const activate=(rule:TriggerRule,scope:string,label:string)=>{
    const timestamp=now();
    const key=scope+':'+rule.key;
    const last=lastFired.get(key);
    if(last!==undefined && timestamp-last<Math.max(2500,rule.durationMs/2))return false;
    lastFired.set(key,timestamp);
    if(lastFired.size>256)lastFired.delete(lastFired.keys().next().value!);
    end();
    cue={effect:rule.effect,label:labelSafe(label),key:rule.key,durationMs:rule.durationMs};
    hooks.onChange?.({...cue});
    timeout=setTimeout(end,rule.durationMs);
    return true;
  };
  return {
    receiveMessage(message:DisplayMessage){
      if(disposed||!message?.id)return false;
      // Commands must start in the first actual text fragment, not a mention,
      // emote code, quoted substring or other reconstructed content.
      const first=message.parts[0];
      if(first?.type!=='text')return false;
      const text=first.text.trimStart();
      const command=/^(![a-z][a-z0-9_-]{0,23})(?=\s|$)/i.exec(text)?.[1]?.toLowerCase();
      if(!command)return false;
      const rule=rules.find(r=>r.kind==='command'&&r.key===command);
      if(!rule||!roleAllowed(message,rule.access))return false;
      if(!remember('chat:'+sourceOfMessage(message)+':'+message.id))return false;
      return activate(rule,sourceOfMessage(message),command+' · '+message.user.name);
    },
    receiveSignal(signal:SocialSignalV1){
      if(disposed||signal?.schemaVersion!==1||signal.producer!=='chatbus'||
        !signal.source||signal.source.origin==='replay'||!signal.event||
        !Number.isSafeInteger(signal.event.occurredAtMs))return false;
      const rule=rules.find(r=>r.kind==='event'&&r.key===signal.event.type);
      if(!rule)return false;
      const scope=sourceOfSignal(signal);
      // Chatbus event IDs are optional: use origin occurrence + actor as a
      // stable fallback without relying on reconnect-specific receipt times.
      const eventKey=signal.event.id?.trim().slice(0,180) ||
        JSON.stringify([signal.event.type,signal.event.occurredAtMs,
          (signal.actor?.id??signal.actor?.username??'').slice(0,100),
          signal.upstreamBatchId?.slice(0,100)??'']);
      if(!remember('event:'+scope+':'+eventKey))return false;
      return activate(rule,scope,rule.key+' · '+(signal.actor?.displayName??signal.actor?.username??'channel'));
    },
    active:()=>cue?{...cue}:null,
    configure(next:string){if(disposed)return;rules=parseTriggerRules(next,view).rules;end();lastFired.clear();},
    clear(){end();seen.clear();seenOrder.length=0;lastFired.clear();},
    dispose(){disposed=true;end();seen.clear();seenOrder.length=0;lastFired.clear();},
  };
}
