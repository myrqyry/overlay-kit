/** A bounded adapter for the user-cosmetics APIs actually exported by Chatbus.
 * This does not implement or duplicate any provider-specific badge parsing.
 * Expensive provider lookups are deduped/cached with a bounded admission queue. */
import {
  fetchBttvBadgesForUserDetailed, fetchFfzBadgesForUserDetailed,
  fetchSevenTvPaintV4Detailed, fetchSevenTvUserCosmeticsDetailed, mergeBadges,
  type Badge, type EnrichmentResult, type NamePaint, type UserCosmetics,
} from '@myrqyry/chatbus';

export interface CosmeticSources {
  bttv(username:string):Promise<EnrichmentResult<Badge[]>>;
  ffz(username:string):Promise<EnrichmentResult<Badge[]>>;
  sevenTv(twitchUserId:string):Promise<EnrichmentResult<UserCosmetics>>;
  sevenTvV4Paint?(twitchUserId:string):Promise<EnrichmentResult<NamePaint>>;
}
export const chatbusCosmeticSources:CosmeticSources={
  bttv:fetchBttvBadgesForUserDetailed,
  ffz:fetchFfzBadgesForUserDetailed,
  sevenTv:fetchSevenTvUserCosmeticsDetailed,
  sevenTvV4Paint:fetchSevenTvPaintV4Detailed,
};
export interface CosmeticIdentity { id?:string; username:string }
export interface ResolvedCosmetics { badges:Badge[]; namePaint?:NamePaint }
export interface CosmeticResolver {
  resolve(identity:CosmeticIdentity):Promise<ResolvedCosmetics|null>;
  close():void;
}
export function createUserCosmeticsResolver(
  sources:CosmeticSources=chatbusCosmeticSources,
  options:{maxActive?:number;maxQueued?:number;ttlMs?:number;failureTtlMs?:number}={},
):CosmeticResolver {
  const maxActive=Math.max(1,Math.min(4,options.maxActive ?? 2));
  const maxQueued=Math.max(0,Math.min(100,options.maxQueued ?? 48));
  const ttlMs=options.ttlMs ?? 5*60_000;
  const failureTtlMs=options.failureTtlMs ?? 60_000;
  const cache=new Map<string,{value:ResolvedCosmetics|null;expires:number}>();
  const pending=new Map<string,Promise<ResolvedCosmetics|null>>();
  const waiting:(()=>void)[]=[];
  let active=0;
  let closed=false;
  const drain=()=>{
    if(closed)return;
    while(active<maxActive && waiting.length)waiting.shift()?.();
  };
  const lookup=async (identity:CosmeticIdentity):Promise<{value:ResolvedCosmetics|null;failed:boolean}>=>{
    const request=(task:()=>Promise<EnrichmentResult<unknown>>)=>
      Promise.resolve().then(task).catch(()=>({value:null,ok:false}));
    const [bttv,ffz,seven,sevenV4Paint]=await Promise.all([
      request(()=>sources.bttv(identity.username)),
      request(()=>sources.ffz(identity.username)),
      identity.id ? request(()=>sources.sevenTv(identity.id!)) : Promise.resolve({ok:true,value:null}),
      identity.id && sources.sevenTvV4Paint
        ? request(()=>sources.sevenTvV4Paint!(identity.id!))
        : Promise.resolve({ok:true,value:null}),
    ]);
    const valid=(item:EnrichmentResult<unknown>):item is EnrichmentResult<Badge[]> =>
      Array.isArray(item.value);
    const sevenValue=seven.value && typeof seven.value==='object' && 'badges' in seven.value
      ? seven.value as UserCosmetics : null;
    const badges=mergeBadges(
      valid(bttv)?bttv.value ?? []:[],
      valid(ffz)?ffz.value ?? []:[],
      sevenValue?.badges ?? [],
    );
    const v4Paint=sevenV4Paint.value && typeof sevenV4Paint.value==='object' && 'id' in sevenV4Paint.value
      ? sevenV4Paint.value as NamePaint : null;
    const namePaint=v4Paint ?? sevenValue?.namePaint;
    return {value:{badges,...(namePaint?{namePaint}:{})},
      failed:!bttv.ok||!ffz.ok||!seven.ok||!sevenV4Paint.ok};
  };
  return {
    resolve(identity:CosmeticIdentity) {
      const username=identity.username.trim().toLowerCase();
      if(closed || !/^[a-z0-9_]{1,25}$/.test(username))return Promise.resolve(null);
      const key=(identity.id ?? '')+':'+username;
      const cached=cache.get(key);
      if(cached && cached.expires>Date.now())return Promise.resolve(cached.value);
      const existing=pending.get(key);
      if(existing)return existing;
      if(active>=maxActive && waiting.length>=maxQueued)return Promise.resolve(null);
      let start:()=>void=()=>{};
      const result=new Promise<ResolvedCosmetics|null>(resolve=>{
        start=()=>{
          if(closed){resolve(null);return;}
          active++;
          void lookup({...identity,username}).then(({value,failed})=>{
            if(!closed) {
              cache.set(key,{value,expires:Date.now()+(failed?failureTtlMs:ttlMs)});
              while(cache.size>512)cache.delete(cache.keys().next().value!);
            }
            resolve(closed?null:value);
          },()=>resolve(null)).finally(()=>{
            active--;
            pending.delete(key);
            drain();
          });
        };
      });
      pending.set(key,result);
      if(active<maxActive)start();else waiting.push(start);
      return result;
    },
    close() {
      closed=true;
      // In-flight lookups may finish on their own, but will not mutate the
      // cache or publish results. Resolve waiting promises when drained.
      while(waiting.length)waiting.shift()?.();
      cache.clear();
    },
  };
}
