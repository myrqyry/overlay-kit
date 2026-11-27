/** Local-only Kick OAuth client configuration; never bundled in hosted code. */
import {readFileSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';

export interface KickOAuthClient {clientId:string;clientSecret:string}

/** Reads a private user-owned config. Silently leaves Kick sign-in disabled on invalid input. */
export function readKickClientConfig(file=resolve(homedir(),'.config/chatbus/kick-app.json')):KickOAuthClient|undefined {
 try {
  const st=statSync(file);
  if(!st.isFile()||(st.mode&0o077)!==0||
     (typeof process.getuid==='function'&&st.uid!==process.getuid()))return undefined;
  const raw:unknown=JSON.parse(readFileSync(file,'utf8'));
  if(!raw||typeof raw!=='object')return undefined;
  const input=raw as Record<string,unknown>;
  if(typeof input.clientId!=='string'||!input.clientId.trim()||
     typeof input.clientSecret!=='string'||!input.clientSecret.trim())return undefined;
  return {clientId:input.clientId.trim(),clientSecret:input.clientSecret.trim()};
 }catch{return undefined;}
}
