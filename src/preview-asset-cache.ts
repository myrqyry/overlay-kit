import type {NamePaint} from '@myrqyry/chatbus';
import {projectNamePaint,type DisplayBadge,type DisplayMessage,type DisplayNamePaint,type EmoteArtwork} from './chatbus';
import type {OverlayLiveEvent} from './live';

/** Private to the editor/browser origin. Never store raw chat, user IDs or handles. */
export const PREVIEW_ASSET_STORAGE_KEY='myrqyry-overlay-preview-art-v1';
const MAX_AGE_MS=30*24*60*60*1000;
const MAX_JSON_SIZE=150_000;
const safeString=(value:unknown,length:number):string=>
  typeof value==='string'?value.trim().slice(0,length):'';
const asObject=(value:unknown):Record<string,unknown>|null=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const assetUrl=(value:unknown):string|undefined=>{
  if(typeof value!=='string'||value.length>2048)return;
  if(/^\/assets\/[\w./-]{1,256}$/.test(value)&&!value.includes('..'))return value;
  try{
    const url=new URL(value);
    if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;
  }catch{}
};
const sanitizedEmote=(item:unknown):EmoteArtwork|null=>{
  const raw=asObject(item),url=assetUrl(raw?.url),id=safeString(raw?.id,128),code=safeString(raw?.code,80);
  if(!raw||!url||!id||!code)return null;
  const overlays=Array.isArray(raw.overlays)?raw.overlays.slice(0,4).flatMap(layer=>{
    const record=asObject(layer),url=assetUrl(record?.url);
    if(!record||!url)return [];
    const flags=record.flags;
    return [{code:safeString(record.code,80)||'overlay',url,
      ...(typeof flags==='number'&&Number.isSafeInteger(flags)&&flags>=0?{flags}:{}),
    }];
  }):[];
  const modifiers=Array.isArray(raw.modifiers)?raw.modifiers.slice(0,8).flatMap(modifier=>{
    const m=asObject(modifier);
    return m&&Number.isSafeInteger(m.flags)&&typeof m.flags==='number'&&m.flags>=0
      ? [{code:safeString(m.code,80),flags:m.flags}] : [];
  }):[];
  return {id,code,url,overlays,modifiers,
    ...(safeString(raw.provider,40)?{provider:safeString(raw.provider,40)}:{}),
    ...(raw.animated===true?{animated:true}:{})};
};
const sanitizedBadges=(items:unknown):DisplayBadge[]=>{
  if(!Array.isArray(items))return [];
  return items.slice(0,12).flatMap(item=>{
    const b=asObject(item);
    const provider=safeString(b?.provider,40);
    const avatar=provider==='twitch-user'||provider==='twitch-source'||provider==='kick-source';
    const name=provider==='twitch-user'?'Viewer picture':avatar?'Channel picture':safeString(b?.name,80);
    const url=assetUrl(b?.url);
    const label=safeString(b?.text,24);
    if(!b||!name||(!url&&!/^[A-Z0-9 ]{1,24}$/.test(label)))return [];
    return [{name,...(url?{url}:{text:label}),
      ...(safeString(b.id,64)?{id:safeString(b.id,64)}:{}),
      ...(provider?{provider}:{}),
      ...(!avatar&&safeString(b.tooltip,120)?{tooltip:safeString(b.tooltip,120)}:{})}];
  });
};
const sanitizedPaint=(item:unknown):DisplayNamePaint|undefined=>{
  const raw=asObject(item);
  if(!raw||!safeString(raw.id,128)||raw.provider!=='7tv'&&raw.provider!=='custom')return;
  // projectNamePaint is the same strict allowlist used for real Chatbus identity.
  // Malformed prior storage must not throw into the editor.
  try{
    const value=projectNamePaint({...raw,id:safeString(raw.id,128)} as unknown as NamePaint);
    if(value&&JSON.stringify(value).length<12_000)return value;
  }catch{}
};
export interface PreviewAssetProfile {
  key:string;
  badges:DisplayBadge[];
  emotes:EmoteArtwork[];
  paint?:DisplayNamePaint;
}
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface PreviewAssetLibraryOptions {
  storage?:StorageLike;
  now?:()=>number;
  maxProfiles?:number;
}
const normalizeProfile=(item:unknown):PreviewAssetProfile|null=>{
  const raw=asObject(item);
  const key=safeString(raw?.key,40);
  if(!raw||!/^p\d{1,9}$/.test(key))return null;
  const badges=sanitizedBadges(raw.badges);
  const emotes=Array.isArray(raw.emotes)
    ?raw.emotes.slice(0,3).flatMap(emote=>{const clean=sanitizedEmote(emote);return clean?[clean]:[];}):[];
  const paint=sanitizedPaint(raw.paint);
  if(!badges.length&&!emotes.length&&!paint)return null;
  return {key,badges,emotes,...(paint?{paint}:{})};
};

interface TrackedMessage {
  key:string;sourceId?:string;userId?:string;username?:string;
  badges:DisplayBadge[];emotes:EmoteArtwork[];paint?:DisplayNamePaint;
}
export function createPreviewAssetLibrary(options:PreviewAssetLibraryOptions={}){
  let storage=options.storage;
  if(storage===undefined){try{storage=localStorage;}catch{/* Storage disabled. */}}
  const now=options.now??Date.now;
  const limit=Number.isInteger(options.maxProfiles)?Math.max(1,Math.min(48,options.maxProfiles!)):32;
  let records:PreviewAssetProfile[]=[];
  let next=1;
  try{
    const json=storage?.getItem(PREVIEW_ASSET_STORAGE_KEY);
    if(json&&json.length<MAX_JSON_SIZE){
      const saved=asObject(JSON.parse(json));
      if(saved?.version===1&&Number.isFinite(saved.savedAt) &&
        now()-(saved.savedAt as number)>=0&&now()-(saved.savedAt as number)<MAX_AGE_MS&&
        Array.isArray(saved.profiles)){
        records=saved.profiles.slice(-limit).flatMap(item=>{
          const profile=normalizeProfile(item);return profile?[profile]:[];
        });
        next=Math.max(1,...records.map(profile=>Number(profile.key.slice(1))+1));
      }
    }
  }catch{/* Cache corrupt or unavailable; never block the editor. */}
  const tracked=new Map<string,TrackedMessage>();
  const write=()=>{
    if(!storage)return;
    try{
      let json=JSON.stringify({version:1,savedAt:now(),profiles:records});
      while(records.length&&json.length>MAX_JSON_SIZE){
        records.shift();
        json=JSON.stringify({version:1,savedAt:now(),profiles:records});
      }
      storage.setItem(PREVIEW_ASSET_STORAGE_KEY,json);
    }catch{/* Quota/permissions failures do not affect live chat. */}
  };
  const save=(item:TrackedMessage):boolean=>{
    const profile=normalizeProfile({key:item.key,badges:item.badges,emotes:item.emotes,paint:item.paint});
    const existing=records.findIndex(record=>record.key===item.key);
    if(!profile){
      if(existing<0)return false;
      records.splice(existing,1);write();return true;
    }
    const fingerprint=(record:PreviewAssetProfile)=>JSON.stringify([record.badges,record.emotes,record.paint??null]);
    const signature=fingerprint(profile);
    if(existing>=0 && fingerprint(records[existing]!)===signature)return false;
    // A busy channel often repeats the same badge/emote bundle across many
    // messages. Retain distinct visual combinations, not one entry per chatter.
    if(records.some((record,index)=>index!==existing&&fingerprint(record)===signature)){
      if(existing<0)return false;
      records.splice(existing,1);write();return true;
    }
    if(existing>=0)records.splice(existing,1);
    records.push(profile);
    while(records.length>limit)records.shift();
    write();
    return true;
  };
  const remove=(predicate:(item:TrackedMessage,id:string)=>boolean):boolean=>{
    const keys=new Set<string>();
    for(const [id,item] of tracked){
      if(predicate(item,id)){keys.add(item.key);tracked.delete(id);}
    }
    if(!keys.size)return false;
    const before=records.length;
    records=records.filter(profile=>!keys.has(profile.key));
    if(records.length===before)return false;
    write();return true;
  };
  return {
    storageKey:PREVIEW_ASSET_STORAGE_KEY,
    profiles:():PreviewAssetProfile[]=>records.map(r=>({key:r.key,
      badges:r.badges.map(b=>({...b})),emotes:r.emotes.map(e=>({...e,overlays:e.overlays.map(o=>({...o})),modifiers:e.modifiers.map(m=>({...m}))})),
      ...(r.paint?{paint:structuredClone(r.paint)}:{})})),
    observe(event:OverlayLiveEvent):boolean{
      if(event.type==='message'){
        const message:DisplayMessage=event.message;
        if(!message.id||tracked.has(message.id))return false;
        const item:TrackedMessage={
          key:'p'+next++,sourceId:message.sourceId,userId:message.user.id,
          username:message.user.username?.toLowerCase(),
          badges:sanitizedBadges(message.user.badges),
          emotes:message.parts.filter(p=>p.type==='emote').slice(0,3).flatMap(p=>{
            if(p.type!=='emote'||p.emote.content?.sexual||p.emote.content?.epilepsy||p.emote.content?.edgy)return [];
            const art=sanitizedEmote(p.emote);return art?[art]:[];
          }),
          paint:sanitizedPaint(message.user.namePaint),
        };
        tracked.set(message.id,item);
        while(tracked.size>160)tracked.delete(tracked.keys().next().value!);
        return save(item);
      }
      if(event.type==='badges'||event.type==='identity'){
        const item=tracked.get(event.messageId);
        if(!item)return false;
        item.badges=sanitizedBadges(event.badges);
        if(event.type==='identity'&&event.namePaint)item.paint=sanitizedPaint(event.namePaint);
        return save(item);
      }
      if(event.type==='delete')return remove((_,id)=>id===event.messageId);
      if(event.type==='user-clear')return remove(item=>
        (!event.sourceId||event.sourceId===item.sourceId)&&
        Boolean((event.userId&&event.userId===item.userId)||
          (event.username&&event.username.toLowerCase()===item.username)));
      if(event.type==='clear')return remove(item=>!event.sourceId||item.sourceId===event.sourceId);
      return false;
    },
    clear(){records=[];tracked.clear();next=1;try{storage?.removeItem(PREVIEW_ASSET_STORAGE_KEY);}catch{}},
  };
}
