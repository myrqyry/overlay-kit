/** Bounded public Twitch chatter avatar lookups. Never hold chat delivery while loading. */
const VALID_LOGIN=/^[a-z0-9_]{1,25}$/;

export function createTwitchViewerAvatarLookup(load:(login:string)=>Promise<string|null>){
 const MAX_ACTIVE=3, MAX_QUEUE=48, MAX_CACHED=256;
 type Job={login:string;finish:(image:string|null)=>void};
 const queue:Job[]=[];
 const pending=new Map<string,Promise<string|null>>();
 const cache=new Map<string,{url:string|null;expiresAt:number}>();
 let active=0,closed=false;
 const drain=()=>{
  while(!closed && active<MAX_ACTIVE && queue.length){
   const job=queue.shift()!;
   active++;
   Promise.resolve().then(()=>load(job.login)).catch(()=>null).then(value=>{
    pending.delete(job.login);
    if(!closed){
     cache.delete(job.login);
     cache.set(job.login,{url:value,expiresAt:Date.now()+(value?30*60_000:60_000)});
     while(cache.size>MAX_CACHED)cache.delete(cache.keys().next().value!);
    }
    job.finish(closed?null:value);
   }).finally(()=>{active--;drain();});
  }
 };
 return {
  get(login:string):Promise<string|null>{
   const name=login.trim().toLowerCase();
   if(closed||!VALID_LOGIN.test(name))return Promise.resolve(null);
   const hit=cache.get(name);
   if(hit){
    cache.delete(name);
    if(hit.expiresAt>Date.now()){
     cache.set(name,hit);
     return Promise.resolve(hit.url);
    }
   }
   const existing=pending.get(name);
   if(existing)return existing;
   if(queue.length>=MAX_QUEUE)return Promise.resolve(null);
   let finish!:(image:string|null)=>void;
   const result=new Promise<string|null>(resolve=>{finish=resolve;});
   pending.set(name,result);
   queue.push({login:name,finish});
   drain();
   return result;
  },
  close(){
   if(closed)return;
   closed=true;
   for(const job of queue.splice(0)){pending.delete(job.login);job.finish(null);}
   cache.clear();
  },
 };
}
