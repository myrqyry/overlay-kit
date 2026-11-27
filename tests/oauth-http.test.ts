// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLiveServer} from '../server/http';
import {resolve} from 'node:path';

describe('loopback OAuth callback and control protection',()=>{
 it('checks origin on login, validates state on callback, and keeps tokens off the public status response',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'overlay-oauth-http-'));
  vi.stubEnv('OVERLAY_YOUTUBE_CLIENT_ID','client');vi.stubEnv('OVERLAY_YOUTUBE_CLIENT_SECRET','secret');
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({access_token:'access-value',refresh_token:'refresh-value',expires_in:3600,token_type:'Bearer'})));
  const server=await createLiveServer({port:0,root:resolve('dist-demo'),restore:false,oauthFile:join(dir,'oauth.json'),oauthFetch:fetcher});
  try{
   const base=server.address;
   const request=(url:string,origin:string)=>fetch(base+url,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({provider:'youtube'})});
   expect((await request('/api/oauth/start','https://attacker.example')).status).toBe(403);
   const response=await request('/api/oauth/start',base);
   expect(response.status).toBe(200);
   const start=await response.json() as {url:string};
   const authUrl=new URL(start.url);
   const state=authUrl.searchParams.get('state');
   expect(state).toBeTruthy();
   const invalid=await fetch(base+'/api/oauth/callback?state=bad&code=code',{redirect:'manual'});
   expect(invalid.headers.get('location')).toBe('/?oauth=failed');
   const callback=await fetch(base+'/api/oauth/callback?state='+state+'&code=code',{redirect:'manual'});
   expect(callback.headers.get('location')).toBe('/?oauth=connected');
   const status=await fetch(base+'/api/oauth/status').then(r=>r.text());
   expect(status).toContain('"youtube":true');
   expect(status).not.toContain('access-value');
   expect(status).not.toContain('refresh-value');
   expect(fetcher).toHaveBeenCalledTimes(1);
  }finally{await server.close();rmSync(dir,{recursive:true,force:true});vi.unstubAllEnvs();}
 });
});

describe('Kick app credentials in local relay',()=>{
 it('offers the configured Kick login using registered localhost redirect and keeps the anonymous source separate',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'overlay-kick-http-'));
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({access_token:'private-token',refresh_token:'refresh',expires_in:3600,token_type:'Bearer'})));
  const server=await createLiveServer({port:0,root:resolve('dist-demo'),restore:false,
    oauthFile:join(dir,'oauth.json'),oauthFetch:fetcher,kickClient:{clientId:'kick-id',clientSecret:'kick-secret'}});
  try{
   const base=server.address;
   const before=await fetch(base+'/api/oauth/status').then(r=>r.text());
   expect(before).toContain('"kick":true');
   expect(before).not.toContain('kick-secret');
   const headers={'origin':base,'content-type':'application/json'};
   const forbidden=await fetch(base+'/api/oauth/start',{method:'POST',headers:{...headers,origin:'https://attacker.test'},
     body:JSON.stringify({provider:'kick'})});
   expect(forbidden.status).toBe(403);
   const started=await fetch(base+'/api/oauth/start',{method:'POST',headers,
     body:JSON.stringify({provider:'kick'})});
   expect(started.status).toBe(200);
   const target=new URL((await started.json() as {url:string}).url);
   expect(target.origin).toBe('https://id.kick.com');
   const redirect=new URL(target.searchParams.get('redirect_uri')!);
   expect(redirect.hostname).toBe('localhost');
   expect(redirect.port).toBe(new URL(base).port);
   expect(redirect.pathname).toBe('/api/oauth/callback');
   const state=target.searchParams.get('state');
   const callback=await fetch(base+'/api/oauth/callback?state='+state+'&code=code',{redirect:'manual'});
   expect(callback.status).toBe(303);
   expect(callback.headers.get('location')).toBe(base+'/?oauth=connected');
   const after=await fetch(base+'/api/oauth/status').then(r=>r.text());
   expect(after).toContain('"kick":true');
   expect(after).not.toContain('private-token');
   expect(after).not.toContain('kick-secret');
  }finally{await server.close();rmSync(dir,{recursive:true,force:true});}
 });
});
