import {describe,it,expect,vi} from 'vitest';
import {createLiveSourceChips} from '../demo/live-source-chips';
import {createSourceSubscriptions} from '../src/source-subscriptions';
const twitch={platform:'twitch' as const,channel:'garden'};
const kick={platform:'kick' as const,channel:'garden'};
describe('per-source chip readiness and actions',()=>{
 it('retains each chip and open menu as readiness changes and targets only the clicked source',()=>{
  const root=document.createElement('div'),menu=document.createElement('div');
  menu.hidden=true;document.body.append(root,menu);
  const action=vi.fn(),select=vi.fn();
  const chips=createLiveSourceChips({root,menu,onAction:action,onSelect:select});
  const status=new Map([['twitch:garden',{state:'connected',emotes:'ready',badges:'loading'}],['kick:garden',{state:'error',emotes:'degraded',badges:'idle'}]]);
  try{
   chips.render([twitch,kick],status,null,new Set());
   const first=root.querySelector<HTMLButtonElement>('[data-platform=twitch].live-source-chip')!;
   const second=root.querySelector<HTMLButtonElement>('[data-platform=kick].live-source-chip')!;
   expect(first.querySelectorAll('.live-status-dot')).toHaveLength(3);
   expect(Array.from(second.querySelectorAll<HTMLElement>('.live-status-dot')).map(e=>e.dataset.state)).toEqual(['error','degraded','idle']);
   second.click();expect(menu.hidden).toBe(false);expect(select).toHaveBeenCalledWith(kick);
   chips.render([twitch,kick],status,kick,new Set());
   expect(root.firstElementChild).toBe(first);
   expect(menu.hidden).toBe(false);
   menu.querySelector<HTMLButtonElement>('[data-action=reconnect]')!.click();
   expect(action).toHaveBeenCalledWith('reconnect',kick);
   expect(menu.hidden).toBe(true);
   first.click();chips.render([kick],status,kick,new Set());
   expect(menu.hidden).toBe(true);
  }finally{chips.dispose();root.remove();menu.remove();}
 });
 it('reconciles hosted subscriptions independently, invalidates stale callbacks and reconnects only requested source',()=>{
  const opened:string[]=[],closed:string[]=[],received:string[]=[],callbacks:((v:string)=>void)[]=[];
  const sessions=createSourceSubscriptions<string>((source,onValue)=>{
   const key=source.platform+':'+source.channel;opened.push(key);callbacks.push(onValue);
   return {dispose(){closed.push(key);}};
  },(source,value)=>received.push(source.platform+':'+value));
  sessions.sync([twitch,kick]);sessions.sync([twitch,kick]);
  sessions.reconnect(kick);callbacks[1]!('stale');callbacks[2]!('fresh');
  expect(opened).toEqual(['twitch:garden','kick:garden','kick:garden']);
  expect(closed).toEqual(['kick:garden']);expect(received).toEqual(['kick:fresh']);
  sessions.sync([kick]);expect(closed).toEqual(['kick:garden','twitch:garden']);
  sessions.dispose();expect(closed).toEqual(['kick:garden','twitch:garden','kick:garden']);
 });
});
