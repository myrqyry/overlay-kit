import type {ViewerSource} from './channel-choice';

export const sourceKey=(source:ViewerSource)=>source.platform+':'+source.channel;

/** Own only this document's room listeners. Never restart other rooms. */
export function createSourceSubscriptions<T>(
 open:(source:ViewerSource,receive:(value:T)=>void)=>{dispose():void},
 receive:(source:ViewerSource,value:T)=>void,
 onRemove?:(source:ViewerSource)=>void,
){
 const active=new Map<string,{source:ViewerSource;handle?:{dispose():void}}>();
 const remove=(key:string)=>{
  const entry=active.get(key);if(!entry)return;
  active.delete(key);entry.handle?.dispose();onRemove?.(entry.source);
 };
 const add=(source:ViewerSource)=>{
  const key=sourceKey(source);if(active.has(key))return;
  const entry:{source:ViewerSource;handle?:{dispose():void}}={source};
  active.set(key,entry);
  try{
   const handle=open(source,value=>{if(active.get(key)===entry)receive(source,value);});
   if(active.get(key)===entry)entry.handle=handle;else handle.dispose();
  }catch(error){active.delete(key);throw error;}
 };
 return {
  sync(sources:readonly ViewerSource[]){
   const wanted=new Set(sources.map(sourceKey));
   for(const key of active.keys())if(!wanted.has(key))remove(key);
   for(const source of sources)add(source);
  },
  reconnect(source:ViewerSource){const key=sourceKey(source);if(!active.has(key))return;remove(key);add(source);},
  dispose(){for(const key of active.keys())remove(key);},
 };
}
