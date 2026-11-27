import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const config=JSON.parse(readFileSync(resolve(process.cwd(),'vercel.json'),'utf8'));
describe('Vercel browser cache boundaries',()=>{
 it('allows long-term caching only for content-hashed Vite assets',()=>{
  const rule=config.headers?.find((value:{source:string})=>value.source==='/assets/(.*)');
  expect(rule?.headers).toContainEqual({key:'Cache-Control',value:'public, max-age=31536000, immutable'});
 });
 it('does not cache live WebSocket and status routes as static content',()=>{
  for(const rule of config.headers??[]){
   expect(rule.source).not.toMatch(/^\/api\/live/);
  }
 });
});
