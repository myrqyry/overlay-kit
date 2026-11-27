import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
describe('public preview source polish',()=>{
 it('ships a real icon for editor and both OBS source pages',()=>{
   expect(existsSync(resolve(root,'public/favicon.svg'))).toBe(true);
   for(const filename of ['index.html','chat.html','wall.html','avatars.html','events.html']){
     const page=readFileSync(resolve(root,filename),'utf8');
     expect(page).toContain('rel="icon"');
     expect(page).toContain('href="/favicon.svg"');
   }
 });
});
