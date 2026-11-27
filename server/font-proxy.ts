/** Loopback Google Fonts proxy. Browsers/OBS need only localhost access.
 * The only upstreams are Google's CSS2 service and its font CDN; callers
 * cannot provide arbitrary URLs or request unspecified remote resources. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import type {ServerResponse} from 'node:http';
import {googleFontCssUrl,normalizeGoogleFontFamily} from '../src/google-fonts';

const MAX_CSS = 512 * 1024;
const MAX_FONT = 8 * 1024 * 1024;
const FONT_CACHE_LIMIT = 48 * 1024 * 1024;
const FONT_TTL = 24 * 60 * 60 * 1000;
const CSS_TTL = 6 * 60 * 60 * 1000;
const FONT_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
type CacheRecord<T> = {value:T;expiresAt:number};

function response(res:ServerResponse, status:number, contentType:string,body:string|Buffer) {
  res.writeHead(status,{
    'content-type':contentType,
    'cache-control':'private, max-age=3600',
    'x-content-type-options':'nosniff',
  });
  res.end(body);
}
async function boundedDownload(fetcher:typeof fetch,url:string,max:number):Promise<Buffer> {
  const result=await fetcher(url,{headers:{'User-Agent':FONT_UA},signal:AbortSignal.timeout(12000)});
  if(!result.ok)throw Error('Font service responded '+result.status);
  if(Number(result.headers.get('content-length'))>max)throw Error('Font response too large');
  const reader=result.body?.getReader();
  if(!reader)throw Error('Empty font response');
  const chunks:Buffer[]=[];
  let received=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      received+=value.byteLength;
      if(received>max){
        await reader.cancel();
        throw Error('Font response exceeded maximum size');
      }
      chunks.push(Buffer.from(value));
    }
  }finally{reader.releaseLock();}
  return Buffer.concat(chunks,received);
}
function allowedFontUrl(input:string):boolean {
  try {
    const u=new URL(input);
    return u.origin==='https://fonts.gstatic.com' &&
      /^\/[A-Za-z0-9/_.,+-]+$/.test(u.pathname) && !u.search && !u.hash;
  }catch{return false;}
}
export function createGoogleFontProxy(distRoot:string,fetcher:typeof fetch=fetch) {
  const entries=JSON.parse(readFileSync(resolve(distRoot,'google-fonts.json'),'utf8')) as {
    fonts:{family:string}[];
  };
  const families=new Set(entries.fonts.map(f=>f.family));
  const cssCache=new Map<string,CacheRecord<string>>();
  const cssPending=new Map<string,Promise<string>>();
  const assets=new Map<string,string>();
  const fontCache=new Map<string,CacheRecord<Buffer>>();
  const fontPending=new Map<string,Promise<Buffer>>();
  let fontCacheBytes=0;
  async function fetchCss(name:string):Promise<string> {
    const url=googleFontCssUrl(name);
    if(!url)throw Error('Invalid family');
    const buffer=await boundedDownload(fetcher,url,MAX_CSS);
    const raw=buffer.toString('utf8');
    let replaced=0;
    const transformed=raw.replace(/url\(["']?(https:\/\/fonts\.gstatic\.com\/[^\s)"']+)["']?\)/g,(match,path:string)=>{
      if(!allowedFontUrl(path))return match;
      const id=createHash('sha256').update(path).digest('hex').slice(0,32);
      // A long-running studio must not keep an unbounded table of CDN URLs.
      assets.delete(id);
      assets.set(id,path);
      while(assets.size>10000) assets.delete(assets.keys().next().value!);
      replaced++;
      return 'url("/api/fonts/file/'+id+'")';
    });
    if(!replaced||/url\(["']?https?:\/\//.test(transformed))
      throw Error('Unexpected Google Fonts CSS; refusing remote asset URLs');
    return transformed;
  }
  function getCss(name:string) {
    const cached=cssCache.get(name);
    if(cached&&cached.expiresAt>Date.now())return Promise.resolve(cached.value);
    const ongoing=cssPending.get(name);
    if(ongoing)return ongoing;
    const task=fetchCss(name).then(body=>{
      cssCache.set(name,{value:body,expiresAt:Date.now()+CSS_TTL});
      while(cssCache.size>80)cssCache.delete(cssCache.keys().next().value!);
      return body;
    }).finally(()=>cssPending.delete(name));
    cssPending.set(name,task);
    return task;
  }
  function getFont(id:string) {
    const cached=fontCache.get(id);
    if(cached&&cached.expiresAt>Date.now())return Promise.resolve(cached.value);
    const ongoing=fontPending.get(id);
    if(ongoing)return ongoing;
    const url=assets.get(id);
    if(!url)return Promise.reject(Error('Unknown font asset'));
    const task=boundedDownload(fetcher,url,MAX_FONT).then(bytes=>{
      // LRU-ish bounded memory store; never cache oversized assets.
      if(bytes.byteLength<=FONT_CACHE_LIMIT) {
        const prev=fontCache.get(id);
        if(prev)fontCacheBytes-=prev.value.byteLength;
        fontCache.delete(id);
        fontCache.set(id,{value:bytes,expiresAt:Date.now()+FONT_TTL});
        fontCacheBytes+=bytes.byteLength;
        while(fontCacheBytes>FONT_CACHE_LIMIT && fontCache.size>1){
          const first=fontCache.keys().next().value!;
          fontCacheBytes-=fontCache.get(first)!.value.byteLength;
          fontCache.delete(first);
        }
      }
      return bytes;
    }).finally(()=>fontPending.delete(id));
    fontPending.set(id,task);
    return task;
  }
  return {
    async handle(path:string,search:URLSearchParams,res:ServerResponse):Promise<boolean> {
      if(path==='/api/fonts/css'){
        const name=normalizeGoogleFontFamily(search.get('family'));
        if(!name||!families.has(name)){
          response(res,400,'text/plain; charset=utf-8','Unknown Google Font family');return true;
        }
        try{
          response(res,200,'text/css; charset=utf-8',await getCss(name));
        }catch{
          response(res,502,'text/plain; charset=utf-8','Could not load Google font');}
        return true;
      }
      if(path.startsWith('/api/fonts/file/')){
        const id=path.slice('/api/fonts/file/'.length);
        if(!/^[a-f0-9]{32}$/.test(id)||!assets.has(id)){
          response(res,404,'text/plain; charset=utf-8','Unknown font asset');return true;
        }
        try {
          const url=assets.get(id)!;
          const contentType=url.endsWith('.woff2')?'font/woff2'
            :url.endsWith('.woff')?'font/woff'
            :url.endsWith('.otf')?'font/otf':'font/ttf';
          response(res,200,contentType,await getFont(id));
        }catch{
          response(res,502,'text/plain; charset=utf-8','Font asset unavailable');}
        return true;
      }
      return false;
    },
  };
}
