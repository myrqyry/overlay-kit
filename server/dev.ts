import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer as createViteServer,type ViteDevServer} from 'vite';
import {createLiveServer} from './http';

export interface DevHostOptions { port?:number; livePort?:number; cacheDir?:string; }
export interface DevHost {
  origin:string;
  close():Promise<void>;
}

const validPort=(value:number,name:string)=>{
  if(!Number.isInteger(value)||value<0||value>65535||(value>0&&value<1024))
    throw new Error(`Invalid ${name}`);
  return value;
};

export async function startDevHost(options:DevHostOptions={}):Promise<DevHost>{
  const port=validPort(options.port??5173,'dev port');
  const livePort=validPort(options.livePort??0,'live port');
  const origin=`http://127.0.0.1:${port}`;
  const live=await createLiveServer({port:livePort,publicOrigin:origin});
  let vite:ViteDevServer|undefined;
  try{
    const proxy={
      '/api/live':{target:live.address,changeOrigin:false},
      '/api/oauth':{target:live.address,changeOrigin:false},
      '/api/fonts':{target:live.address,changeOrigin:false},
      '/live':{target:live.address,changeOrigin:false,ws:true},
    };
    vite=await createViteServer({
      cacheDir:options.cacheDir??resolve('node_modules/.vite-overlay-dev'),
      server:{host:'127.0.0.1',port,strictPort:true,proxy},
    });
    await vite.listen();
  }catch(error){
    await live.close();
    throw error;
  }
  let closed=false;
  return {
    origin,
    async close(){
      if(closed)return;closed=true;
      await Promise.allSettled([vite!.close(),live.close()]);
    },
  };
}

const entry=process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if(import.meta.url===entry){
  const port=process.env.OVERLAY_DEV_PORT?Number(process.env.OVERLAY_DEV_PORT):5173;
  const livePort=process.env.OVERLAY_DEV_LIVE_PORT?Number(process.env.OVERLAY_DEV_LIVE_PORT):0;
  const host=await startDevHost({port,livePort});
  console.log(`Overlay Kit dev host: ${host.origin}`);
  console.log('Vite HMR + /api/live + /live are available on the same origin.');
  let stopping=false;
  const shutdown=()=>{
    if(stopping)return;stopping=true;
    void host.close().finally(()=>process.exit(0));
  };
  process.on('SIGINT',shutdown);
  process.on('SIGTERM',shutdown);
}
