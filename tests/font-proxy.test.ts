// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {createLiveServer} from '../server/http';
import type {LiveSource} from '../server/hub';
import {resolve} from 'node:path';

const source:LiveSource={
  connect:()=>({close(){}}),
  emotes:async()=>({emotes:{},complete:true}),
};
const css="@font-face {font-family:'Space Grotesk';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/spacegrotesk/v1/demo.woff2) format('woff2')}";
describe('loopback Google Fonts proxy',()=>{
 it('serves only catalog families and mirrors verified Google CDN assets with caching',async()=>{
  const requests:string[]=[];
  const fontFetch=vi.fn(async(input:string|URL|Request)=>{
    const url=String(input);
    requests.push(url);
    return new Response(url.includes('fonts.googleapis.com')?css:new Uint8Array([0x77,0x4f,0x46,0x32]),
      {status:200,headers:{'content-type':url.includes('googleapis')?'text/css':'font/woff2'}});
  }) as unknown as typeof fetch;
  const server=await createLiveServer({port:0,source,restore:false,root:resolve('dist-demo'),
    fontFetch,cosmetics:()=>({resolve:async()=>null})});
  try{
    const base=server.address;
    const unknown=await fetch(base+'/api/fonts/css?family=NotAFontAtAll');
    expect(unknown.status).toBe(400);
    const script=await fetch(base+'/api/fonts/css?family='+encodeURIComponent('Roboto);background:url(http://evil.test)'));
    expect(script.status).toBe(400);
    const c=await fetch(base+'/api/fonts/css?family=Space%20Grotesk');
    expect(c.status).toBe(200);
    expect(c.headers.get('content-type')).toContain('text/css');
    const text=await c.text();
    expect(text).not.toContain('fonts.gstatic.com');
    const assetPath=text.match(/\/api\/fonts\/file\/[a-f0-9]{32}/)?.[0];
    expect(assetPath).toBeTruthy();
    expect((await (await fetch(base+assetPath)).arrayBuffer()).byteLength).toBe(4);
    expect((await fetch(base+assetPath)).status).toBe(200);
    expect((await fetch(base+'/api/fonts/css?family=Space%20Grotesk')).status).toBe(200);
    expect(requests).toHaveLength(2); // one stylesheet, one font binary
    expect((await fetch(base+'/api/fonts/file/'+('0'.repeat(32)))).status).toBe(404);
    const badMethod=await fetch(base+'/api/fonts/css?family=Roboto',{method:'POST'});
    expect(badMethod.status).toBe(405);
  }finally{await server.close();}
 });
 it('rejects oversized font assets from a dishonest upstream server',async()=>{
   const fontFetch=vi.fn(async(input:string|URL|Request)=>{
     const url=String(input);
     if(url.includes('googleapis'))return new Response(css,{status:200});
     return new Response(new Uint8Array([1,2,3]),{status:200,headers:{'content-length':String(9*1024*1024)}});
   }) as unknown as typeof fetch;
   const server=await createLiveServer({port:0,source,restore:false,root:resolve('dist-demo'),
      fontFetch,cosmetics:()=>({resolve:async()=>null})});
   try{
     const cssResponse=await fetch(server.address+'/api/fonts/css?family=Space%20Grotesk');
     const text=await cssResponse.text();
     const path=text.match(/\/api\/fonts\/file\/[a-f0-9]{32}/)?.[0];
     expect(path).toBeTruthy();
     expect((await fetch(server.address+path)).status).toBe(502);
   }finally{await server.close();}
 });
 it('refuses CSS from unexpected remote origins and continues serving the app',async()=>{
  const fontFetch=vi.fn(async()=>new Response(
    "@font-face{src:url(https://malicious.example/evil.woff2)}",
    {status:200})) as unknown as typeof fetch;
  const server=await createLiveServer({port:0,source,restore:false,root:resolve('dist-demo'),
    fontFetch,cosmetics:()=>({resolve:async()=>null})});
  try {
    expect((await fetch(server.address+'/api/fonts/css?family=Roboto')).status).toBe(502);
    expect((await fetch(server.address+'/chat.html')).status).toBe(200);
  }finally{await server.close();}
 });
});
