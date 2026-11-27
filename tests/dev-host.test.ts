// @vitest-environment node
import {createServer as createNetServer} from 'node:net';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {WebSocket} from 'ws';
import {startDevHost,type DevHost} from '../server/dev';

const freePort=()=>new Promise<number>((resolve,reject)=>{
  const server=createNetServer();
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
    const address=server.address();
    if(!address||typeof address==='string'){server.close();reject(new Error('No port'));return;}
    const port=address.port;server.close(error=>error?reject(error):resolve(port));
  });
});

describe('combined Overlay Kit dev host',()=>{
  let host:DevHost|undefined;
  let cacheDir:string|undefined;
  afterEach(async()=>{await host?.close();host=undefined;if(cacheDir)await rm(cacheDir,{recursive:true,force:true});cacheDir=undefined;},15000);

  it('serves Vite/HMR and proxies the local live HTTP + websocket contract on one origin',async()=>{
    const port=await freePort();
    cacheDir=await mkdtemp(join(tmpdir(),'overlay-kit-vite-'));
    host=await startDevHost({port,livePort:0,cacheDir});
    const origin=`http://127.0.0.1:${port}`;

    const page=await fetch(origin+'/');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('/@vite/client');

    const status=await fetch(origin+'/api/live/status');
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({service:'overlay-kit-live',mode:'local'});

    const gsapImporter=await fetch(origin+'/src/chat-deletion.ts');
    expect(gsapImporter.status).toBe(200);
    expect(await gsapImporter.text()).toContain('gsap');
    const optimizedGsap=join(cacheDir,'deps','gsap.js');
    let optimized=false;
    for(let i=0;i<24;i++){
      try{await access(optimizedGsap);optimized=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}
    }
    expect(optimized).toBe(true);

    const malformed=await fetch(origin+'/api/live/connect',{
      method:'POST',headers:{origin,'content-type':'application/json'},body:'{}',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({error:'Channel required'});

    const packet=await new Promise<Record<string,unknown>>((resolve,reject)=>{
      const ws=new WebSocket(origin.replace('http:','ws:')+'/live',{headers:{origin}});
      const timer=setTimeout(()=>{ws.terminate();reject(new Error('websocket timeout'));},3000);
      ws.once('message',data=>{clearTimeout(timer);const value=JSON.parse(String(data));ws.close();resolve(value);});
      ws.once('error',error=>{clearTimeout(timer);reject(error);});
    });
    expect(packet).toMatchObject({type:'status'});
    // Let Vite finish its background dependency discovery before afterEach closes it.
    await new Promise(resolve=>setTimeout(resolve,350));
  },15000);
});
