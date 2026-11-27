import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeOptions,readOptions,writeOptions,DEFAULT_OPTIONS} from '../src/options';
import {createChatMessageElement} from '../src/renderers';

const styles=readFileSync('src/chat-motion.css','utf8');
const message={id:'entrance',timestamp:1,user:{name:'Viewer',badges:[]},parts:[{type:'text' as const,text:'Hello world'}]};
describe('additional per-letter entrances',()=>{
 for(const effect of ['slide','drop','flip','twist','wave'] as const){
  it(`supports ${effect} in URLs, DOM, and CSS without affecting message text`,()=>{
   const options=normalizeOptions({...DEFAULT_OPTIONS,letterEnter:effect});
   expect(options.letterEnter).toBe(effect);
   expect(readOptions('?'+writeOptions(options,'chat'),'chat').letterEnter).toBe(effect);
   const row=createChatMessageElement(message,{letterEnter:effect});
   expect(row.dataset.letterEnter).toBe(effect);
   expect(row.querySelectorAll('.overlay-letter').length).toBe(10);
   expect(row.querySelector('.overlay-message-content')?.textContent).toBe('Hello world');
   expect(styles).toContain(`[data-letter-enter="${effect}"] .overlay-letter`);
   expect(styles).toContain(`@keyframes chat-letter-in-${effect}`);
  });
 }
});
