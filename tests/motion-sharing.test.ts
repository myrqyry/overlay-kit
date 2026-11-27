import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions} from '../src/options';
const css=(name:string)=>readFileSync(`src/${name}.css`,'utf8');
const cases={letterEnter:['spring','drift','soft-land'],enter:['wave','twist'],eventMotion:['flip','spring']} as const;
describe('cross-surface adapted entrances',()=>{
 for(const [field,effects] of Object.entries(cases))for(const effect of effects){
  it(`${field} supports ${effect} in options, URLs, and animations`,()=>{
   const options=normalizeOptions({...DEFAULT_OPTIONS,[field]:effect});
   expect((options as unknown as Record<string,unknown>)[field]).toBe(effect);
   const view=field==='eventMotion'?'events':'chat';
   expect((readOptions('?'+writeOptions(options,view),view) as unknown as Record<string,unknown>)[field]).toBe(effect);
   const selector=field==='letterEnter'?`[data-letter-enter="${effect}"] .overlay-letter`:field==='enter'?`[data-enter="${effect}"]`:`[data-motion="${effect}"] .overlay-event-alert`;
   const source=css(field==='eventMotion'?'events':'chat-motion');
   expect(source).toContain(selector);
   const key=field==='letterEnter'?`chat-letter-in-${effect}`:field==='enter'?`chat-in-${effect}`:`event-${effect}`;
   expect(source).toContain(`@keyframes ${key}`);
  });
 }
});
