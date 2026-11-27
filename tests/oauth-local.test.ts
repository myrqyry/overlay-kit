// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalOAuth} from '../server/oauth-local';

describe('loopback OAuth ownership',()=>{
 it('requires a matching single-use state and persists only server-side credentials',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'overlay-oauth-'));
  try{
   const fake=vi.fn(async()=>new Response(JSON.stringify({access_token:'a',refresh_token:'r',expires_in:3600,token_type:'Bearer'})));
   const auth=createLocalOAuth({file:join(dir,'auth.json'),clients:{youtube:{clientId:'id',clientSecret:'secret'}},fetcher:fake});
   const begin=await auth.begin('youtube','http://127.0.0.1:5219/api/oauth/callback');
   await expect(auth.complete('youtube','wrong','code')).rejects.toThrow(/state/i);
   const retry=await auth.begin('youtube','http://127.0.0.1:5219/api/oauth/callback');
   await auth.complete('youtube',retry.state,'code');
   expect(auth.status().youtube).toBe(true);
   await expect(auth.complete('youtube',begin.state,'code')).rejects.toThrow(/state/i);
   expect(await auth.accessToken('youtube')).toBe('a');
   auth.disconnect('youtube');expect(auth.status().youtube).toBe(false);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});

describe('Kick OAuth local account ownership',()=>{
 it('uses Kick S256 PKCE, exchanges the code, and retains session behind single-use state',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'overlay-kick-oauth-'));
  try {
   const request=vi.fn(async()=>new Response(JSON.stringify({access_token:'kick-access',refresh_token:'kick-refresh',expires_in:3600,token_type:'Bearer'})));
   const auth=createLocalOAuth({file:join(dir,'auth.json'),clients:{kick:{clientId:'kick-id',clientSecret:'kick-secret'}},fetcher:request});
   expect(auth.configured().kick).toBe(true);
   expect(auth.status().kick).toBe(false);
   const uri='http://localhost:5219/api/oauth/callback';
   const begin=await auth.begin('kick',uri);
   const url=new URL(begin.url);
   expect(url.origin).toBe('https://id.kick.com');
   expect(url.searchParams.get('redirect_uri')).toBe(uri);
   expect(url.searchParams.get('scope')).toContain('events:subscribe');
   expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
   await auth.complete('kick',begin.state,'code');
   expect(auth.status().kick).toBe(true);
   expect(await auth.accessToken('kick')).toBe('kick-access');
   const form=new URLSearchParams(String((request.mock.calls[0] as unknown as [string,RequestInit])[1].body));
   expect(form.get('code_verifier')).toBeTruthy();
   expect(form.get('redirect_uri')).toBe(uri);
   await expect(auth.complete('kick',begin.state,'code')).rejects.toThrow(/state/i);
   auth.disconnect('kick');
   expect(auth.status().kick).toBe(false);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
