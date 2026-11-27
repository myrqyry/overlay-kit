// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {createLivePlatformPicker} from '../demo/live-platform-picker';

function setup(){
 const root=document.createElement('div');
 root.innerHTML='<select hidden><option value="twitch">Twitch</option><option value="kick">Kick</option><option value="youtube">YouTube</option><option value="tiktok" disabled>TikTok</option></select><button type="button"></button><div role="menu" hidden></div><input type="text">';
 document.body.append(root);
 const select=root.querySelector('select')!,trigger=root.querySelector('button')!,menu=root.querySelector<HTMLDivElement>('div[role=menu]')!,channel=root.querySelector('input')!;
 const change=vi.fn();select.addEventListener('change',change);
 const picker=createLivePlatformPicker({select,trigger,menu,channel});
 return {root,select,trigger,menu,channel,picker,change,cleanup(){picker.dispose();root.remove();}};
}
describe('compact live platform picker',()=>{
 it('uses a logo-and-chevron trigger, named menu options, contextual placeholder, and one selection event',()=>{
  const s=setup();
  try{
   expect(s.trigger.textContent).toBe('');
   expect(s.trigger.querySelector('.overlay-service-badge svg')).not.toBeNull();
   expect(s.trigger.querySelector('.live-platform-chevron[aria-hidden=true] path')).not.toBeNull();
   expect(s.trigger.getAttribute('aria-label')).toContain('Twitch');
   expect(s.channel.placeholder).toBe('Twitch username');
   s.trigger.click();
   const options=Array.from(s.menu.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]'));
   expect(options.map(o=>o.textContent)).toEqual(['Twitch','Kick','YouTube','TikTok']);
   expect(options.every(o=>o.querySelector('svg'))).toBe(true);
   expect(options[3]!.disabled).toBe(true);
   options[1]!.click();
   expect(s.select.value).toBe('kick');
   expect(s.change).toHaveBeenCalledTimes(1);
   expect(s.channel.placeholder).toBe('Kick username');
   expect(s.trigger.querySelectorAll('.live-platform-chevron')).toHaveLength(1);
   expect(s.menu.hidden).toBe(true);
   expect(document.activeElement).toBe(s.trigger);
   s.select.value='youtube';s.picker.sync();
   expect(s.channel.placeholder).toBe('YouTube live URL or video ID');
   expect(s.trigger.getAttribute('aria-label')).toContain('YouTube');
   expect(s.change).toHaveBeenCalledTimes(1);
  }finally{s.cleanup();}
 });
 it('supports keyboard navigation, capability updates and outside dismissal',()=>{
  const s=setup();
  try{
   s.trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
   expect(s.menu.hidden).toBe(false);
   expect(document.activeElement?.textContent).toBe('Twitch');
   const key=(k:string)=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
   key('End');expect(document.activeElement?.textContent).toBe('YouTube');
   key('ArrowDown');expect(document.activeElement?.textContent).toBe('Twitch');
   key('Escape');expect(s.menu.hidden).toBe(true);
   expect(document.activeElement).toBe(s.trigger);
   s.select.options[3]!.disabled=false;s.picker.sync();
   s.trigger.click();
   expect(s.menu.querySelector<HTMLButtonElement>('[data-platform=tiktok]')?.disabled).toBe(false);
   document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));
   expect(s.menu.hidden).toBe(true);
  }finally{s.cleanup();}
 });
});
