/** Unauthenticated Twitch badge image catalog.
 * IVR mirrors the public badge reference data without granting Twitch OAuth.
 * This is an optional external provider, not Twitch's official badge API.
 * Actual matching, order and badge types come from Chatbus. */
import { resolveBadgeRefs, type Badge, type BadgeRef } from '@myrqyry/chatbus';

type JsonFetcher = (url: string) => Promise<unknown>;
const IVR_ROOT = 'https://api.ivr.fi/v2/twitch/badges';
const TTL_MS = 15 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const VALID_ROOM = /^\d{1,20}$/;
const isRecord = (v:unknown):v is Record<string,unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (value:unknown):string|undefined =>
  typeof value === 'string' && value.length>0 && value.length<256 ? value : undefined;
const badgeImage = (url:unknown) =>
  typeof url === 'string' && /^https:\/\/static-cdn\.jtvnw\.net\/badges\/v1\/[a-z0-9-]+\/[123]$/i.test(url)
    ? url : undefined;

export async function fetchIvrBadgeCatalog(url:string):Promise<unknown> {
  const response = await fetch(url, {signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error('Badge catalog HTTP '+response.status);
  const announced = Number(response.headers.get('content-length'));
  if(announced>MAX_RESPONSE_BYTES) throw new Error('Badge catalog exceeded maximum response size');
  const body = await response.text();
  if(body.length>MAX_RESPONSE_BYTES) throw new Error('Badge catalog exceeded maximum response size');
  return JSON.parse(body) as unknown;
}

export function parseIvrBadgeCatalog(payload:unknown, scope:'global'|'channel'):Badge[] {
  if(!Array.isArray(payload)) throw new Error('Unexpected badge catalog response');
  const result:Badge[]=[];
  for(const item of payload.slice(0,1000)) {
    if(!isRecord(item)) continue;
    const id=str(item.set_id);
    if(!id || !Array.isArray(item.versions)) continue;
    for(const version of item.versions.slice(0,200)) {
      if(!isRecord(version)) continue;
      const badgeVersion=str(version.id);
      if(!badgeVersion) continue;
      const images = [
        {value:version.image_url_1x,scale:1},
        {value:version.image_url_2x,scale:2},
        {value:version.image_url_4x,scale:4},
      ].flatMap(entry => {
        const url=badgeImage(entry.value);
        return url ? [{url,scale:entry.scale}]:[];
      });
      if(images.length===0) continue;
      result.push({provider:'twitch',id,version:badgeVersion,scope,images,
        ...(str(version.title)?{name:str(version.title)}:{}),
        ...(str(version.description)?{tooltip:str(version.description)}:{}),
      });
    }
  }
  return result;
}
export function createTwitchBadgeCatalog(load:JsonFetcher = fetchIvrBadgeCatalog) {
  let global:Badge[]=[];
  let channel:Badge[]=[];
  let activeRoom:string|null=null;
  let globalState:'idle'|'loading'|'ready'|'degraded'='idle';
  let channelState:'idle'|'loading'|'ready'|'degraded'='idle';
  let globalExpiresAt=0;
  let channelExpiresAt=0;
  let globalPending:Promise<void>|null=null;
  let channelPending:Promise<void>|null=null;
  let channelGeneration=0;
  return {
    loadGlobal(onReady:()=>void):Promise<void> {
      if(globalPending)return globalPending;
      if((globalState==='ready'||globalState==='degraded') && Date.now()<globalExpiresAt)
        return Promise.resolve();
      globalState='loading';
      globalPending=load(IVR_ROOT+'/global').then(raw=>{
        global=parseIvrBadgeCatalog(raw,'global');
        globalExpiresAt=Date.now()+TTL_MS;
        globalState='ready';
      },()=>{
        globalState='degraded';
        globalExpiresAt=Date.now()+FAILURE_COOLDOWN_MS;
      }).catch(()=>{
        globalState='degraded';
        globalExpiresAt=Date.now()+FAILURE_COOLDOWN_MS;
      }).then(()=>{
        globalPending=null;
        onReady();
      });
      return globalPending;
    },
    loadChannel(roomId:string,onReady:()=>void):Promise<void> {
      if(!VALID_ROOM.test(roomId))return Promise.resolve();
      if(activeRoom!==roomId) {
        activeRoom=roomId;
        channel=[];channelExpiresAt=0;channelState='idle';
        channelPending=null;
        channelGeneration++;
      }
      if(channelPending)return channelPending;
      if((channelState==='ready'||channelState==='degraded') && Date.now()<channelExpiresAt)
        return Promise.resolve();
      const current=channelGeneration;
      channelState='loading';
      const pending=load(IVR_ROOT+'/channel?id='+encodeURIComponent(roomId)).then(raw=>{
        const parsed=parseIvrBadgeCatalog(raw,'channel');
        if(current!==channelGeneration)return;
        channel=parsed;
        channelExpiresAt=Date.now()+TTL_MS;
        channelState='ready';
      },()=>{
        if(current===channelGeneration) {
          channelState='degraded';
          channelExpiresAt=Date.now()+FAILURE_COOLDOWN_MS;
        }
      }).catch(()=>{
        if(current===channelGeneration) {
          channelState='degraded';
          channelExpiresAt=Date.now()+FAILURE_COOLDOWN_MS;
        }
      }).then(()=>{
        if(current!==channelGeneration)return;
        channelPending=null;
        onReady();
      });
      channelPending=pending;
      return pending;
    },
    resolve(refs:readonly BadgeRef[]):Badge[] {
      // An exact room-specific version beats the same global set/version.
      return resolveBadgeRefs([...refs], [...channel, ...global]);
    },
    health(): 'idle'|'loading'|'ready'|'degraded' {
      if(globalState==='degraded'||channelState==='degraded')return 'degraded';
      if(globalState==='loading'||channelState==='loading')return 'loading';
      if(globalState==='ready')return 'ready';
      return 'idle';
    },
  };
}
export type TwitchBadgeCatalog=ReturnType<typeof createTwitchBadgeCatalog>;
