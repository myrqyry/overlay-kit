import {normalizeLiveChannel,normalizeLivePlatform,type LivePlatform} from './live-platform';

export type ViewerPlatform=LivePlatform;
export interface ViewerSource {platform:ViewerPlatform;channel:string;}

export function normalizeViewerPlatform(value:unknown):ViewerPlatform|null{
  return normalizeLivePlatform(value);
}

/** User-selected room slug. Validation is provider-aware but remains URL-safe. */
export function normalizeViewerChannel(value:unknown,platform:ViewerPlatform='twitch'):string|null{
  return normalizeLiveChannel(value,platform);
}

export function withViewerSource(path:string,platform:ViewerPlatform,value:string):string {
  const [route,query='']=path.split('?',2);
  const params=new URLSearchParams(query);
  const channel=normalizeViewerChannel(value,platform);
  params.delete('channel');
  params.delete('platform');
  if(channel)params.set('channel',channel);
  if(platform!=='twitch')params.set('platform',platform);
  const search=params.toString();
  return route+(search?'?'+search:'');
}

export function readViewerSources(search:string|URLSearchParams):ViewerSource[]{
  const params=typeof search==='string'?new URLSearchParams(search):search;
  const sources:ViewerSource[]=[];
  const seen=new Set<string>();
  const add=(platformValue:unknown,channelValue:unknown)=>{
    const platform=normalizeViewerPlatform(platformValue);
    if(!platform)return;
    const channel=normalizeViewerChannel(channelValue,platform);
    if(!channel)return;
    const key=platform+':'+channel;
    if(seen.has(key))return;
    seen.add(key);sources.push({platform,channel});
  };
  const explicit=params.getAll('source');
  if(explicit.length){
    for(const value of explicit){
      const split=value.indexOf(':');
      if(split<=0)continue;
      add(value.slice(0,split),value.slice(split+1));
    }
    return sources;
  }
  const legacyChannel=params.get('channel');
  if(legacyChannel)add(params.get('platform')??'twitch',legacyChannel);
  return sources;
}

export function withViewerSources(path:string,sources:readonly ViewerSource[]):string{
  const [route,query='']=path.split('?',2);
  const params=new URLSearchParams(query);
  params.delete('source');params.delete('channel');params.delete('platform');
  const normalized=new Set<string>();
  for(const source of sources){
    const platform=normalizeViewerPlatform(source.platform);
    if(!platform)continue;
    const channel=normalizeViewerChannel(source.channel,platform);
    if(!channel)continue;
    const value=platform+':'+channel;
    if(normalized.has(value))continue;
    normalized.add(value);params.append('source',value);
  }
  // An explicit empty selection must not become a default-room URL.
  if(normalized.size===0)params.set('live','0');
  else params.delete('live');
  const search=params.toString();
  return route+(search?'?'+search:'');
}

/** A stored array is authoritative, including an empty or unsupported set.
 * Only a missing/invalid legacy record may opt into the advertised default. */
export function restoreHostedViewerSources(
  saved:string|null, legacy:ViewerSource|null, fallback:ViewerSource|null,
  supported:readonly ViewerPlatform[],
):ViewerSource[]{
  const normalize=(items:unknown[]):ViewerSource[]=>{
    const result:ViewerSource[]=[];
    const seen=new Set<string>();
    for(const item of items){
      if(!item||typeof item!=='object')continue;
      const value=item as {platform?:unknown;channel?:unknown};
      const platform=normalizeViewerPlatform(value.platform);
      const channel=platform?normalizeViewerChannel(value.channel,platform):null;
      if(!platform||!channel||!supported.includes(platform))continue;
      const key=platform+':'+channel;
      if(!seen.has(key)){seen.add(key);result.push({platform,channel});}
    }
    return result;
  };
  if(saved!==null){
    try{
      const parsed:unknown=JSON.parse(saved);
      if(Array.isArray(parsed))return normalize(parsed);
    }catch{/* Malformed legacy data can use the default. */}
  }
  const prior=normalize(legacy?[legacy]:[]);
  return prior.length?prior:normalize(fallback?[fallback]:[]);
}

/** Legacy Twitch helper retained for existing source URLs/callers. */
export function withViewerChannel(path:string,value:string):string {
  return withViewerSource(path,'twitch',value);
}
