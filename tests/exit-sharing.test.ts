import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions} from '../src/options';
const rules=readFileSync('src/chat-motion.css','utf8');
const wall=readFileSync('src/wall-motion.css','utf8');
describe('shared exit vocabulary',()=>{
 for(const [key,modes] of Object.entries({letterExit:['slide','flip','shrink','twist'],exit:['wave','twist','spring'],wallExit:['flip','spring']})){
  for(const mode of modes)it(`${key}:${mode} is selectable, serializable and animated`,()=>{
   const opts=normalizeOptions({...DEFAULT_OPTIONS,[key]:mode});
   expect((opts as unknown as Record<string,unknown>)[key]).toBe(mode);
   const view=key==='wallExit'?'wall':'chat';
   expect((readOptions('?'+writeOptions(opts,view),view) as unknown as Record<string,unknown>)[key]).toBe(mode);
   const css=key==='wallExit'?wall:rules;
   const selector=key==='wallExit'?`[data-wall-exit="${mode}"]`:key==='letterExit'?`[data-letter-exit="${mode}"]`:`[data-exit="${mode}"]`;
   expect(css).toContain(selector);
   const name=key==='wallExit'?`wall-out-${mode}`:key==='letterExit'?`chat-letter-out-${mode}`:`chat-out-${mode}`;
   expect(css).toContain(`@keyframes ${name}`);
  });
 }
});
