import {normalizeTikTokChannel} from '@myrqyry/chatbus';
export type LivePlatform='twitch'|'kick'|'youtube'|'tiktok';

export function normalizeLivePlatform(value:unknown):LivePlatform|null{
  if(value===undefined||value===null||value==='')return 'twitch';
  if(typeof value!=='string')return null;
  const text=value.trim().toLowerCase();
  return text==='twitch'||text==='kick'||text==='youtube'||text==='tiktok'?text:null;
}

function youtubeVideoId(value:string):string|null{
  const text=value.trim();
  if(/^[A-Za-z0-9_-]{11}$/.test(text))return text;
  try{
    const url=new URL(text);
    if(url.hostname==='youtu.be'){
      const id=url.pathname.split('/').filter(Boolean)[0];
      return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
    }
    if(url.hostname==='youtube.com'||url.hostname==='www.youtube.com'||url.hostname==='m.youtube.com'){
      const fromQuery=url.searchParams.get('v');
      const fromPath=url.pathname.match(/^\/(?:live|shorts)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1];
      const id=fromQuery??fromPath;
      return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
    }
  }catch{/* A plain non-ID string is invalid below. */}
  return null;
}

export function normalizeLiveChannel(value:unknown,platform:LivePlatform='twitch'):string|null{
  if(typeof value!=='string')return null;
  if(platform==='youtube')return youtubeVideoId(value);
  if(platform==='tiktok'){try{return normalizeTikTokChannel(value);}catch{return null;}}
  const text=value.trim().replace(/^#/,'').toLowerCase();
  if(platform==='twitch')return /^[a-z0-9_]{1,25}$/.test(text)?text:null;
  return /^[a-z0-9_-]{1,40}$/.test(text)?text:null;
}
