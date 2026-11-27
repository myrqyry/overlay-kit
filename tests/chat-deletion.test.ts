import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatFeed } from '../src/views';
import { applyLiveEvent } from '../src/live-client';
import { DEFAULT_OPTIONS, readOptions, writeOptions, normalizeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const message=(id:string,user='alice'):DisplayMessage=>({
 id,timestamp:100,user:{id:user,username:user,name:'SECRET NAME',badges:[]},
 parts:[{type:'text',text:'SECRET CHAT CONTENT '+id}],
});
const rect=()=>({x:35,y:42,top:42,left:35,width:270,height:74,
 bottom:116,right:305,toJSON:()=>({})});
const mount=(config:Parameters<typeof createChatFeed>[1]={})=>{
 const root=document.createElement('div');
 document.body.append(root);
 const feed=createChatFeed(root,{ttlMs:100000,...config});
 const receive=(id:string,user='alice')=>{
  feed.receive(message(id,user));
  const el=root.querySelector<HTMLElement>('.overlay-chat-message:last-child');
  if(el)el.getBoundingClientRect=rect;
 };
 return {root,feed,receive,done:()=>{feed.dispose();root.remove()}};
};
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals()});

describe('content-free deleted-message afterimages',()=>{
 it.each(['scribble','crumple'] as const)('removes actual user content synchronously before drawing %s',effect=>{
  const {root,feed,receive,done}=mount({deleteEffect:effect});
  receive('one');
  expect(root.textContent).toContain('SECRET CHAT CONTENT');
  applyLiveEvent(feed,{type:'delete',messageId:'one'});
  expect(feed.snapshot()).toHaveLength(0);
  expect(root.querySelector('.overlay-chat-message')).toBeNull();
  expect(root.textContent).toBe('DELETED');
  const ghost=document.querySelector<HTMLElement>('[data-chat-deletion-ghost]');
  expect(ghost?.dataset.chatDeletionGhost).toBe(effect);
  expect(ghost?.textContent).toBe('DELETED');
  expect(ghost?.querySelectorAll('img')).toHaveLength(0);
  expect(ghost?.querySelectorAll('[data-delete-stroke]')).toHaveLength(effect === 'scribble' ? 2 : 3);
  expect(ghost?.getAttribute('aria-hidden')).toBe('true');
  expect(ghost?.style.position).toBe('relative');
  expect(document.body.textContent).not.toContain('SECRET CHAT CONTENT');
  expect(document.body.textContent).not.toContain('SECRET NAME');
  done();expect(document.querySelector('[data-chat-deletion-ghost]')).toBeNull();
 });

 it.each([
  {effect:'scribble' as const, lengths:[67,129]},
  {effect:'crumple' as const, lengths:[48,61,86]},
 ])('uses the actual SVG path lengths and unsquashed stroke geometry for $effect',({effect,lengths})=>{
  const svgPrototype = SVGElement.prototype as SVGElement & {getTotalLength?: () => number};
  const original=svgPrototype.getTotalLength;
  let index=0;
  svgPrototype.getTotalLength=function(){return lengths[index++]!;};
  try {
    const x=mount({deleteEffect:effect});
    x.receive('test');
    x.feed.removeMessage('test');
    const ghost=document.querySelector<HTMLElement>('[data-chat-deletion-ghost]')!;
    const svg=ghost.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 270 74');
    const paths=Array.from(svg.querySelectorAll<SVGPathElement>('[data-delete-stroke]'));
    expect(paths).toHaveLength(lengths.length);
    paths.forEach((path,i)=>{
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(path.style.strokeDasharray).toBe(lengths[i]+'px');
      expect(path.getAttribute('stroke-dasharray')).toBeNull();
      expect(path.getAttribute('d')).toContain('M ');
      expect(path.getAttribute('stroke-linecap')).toBe('round');
    });
    x.done();
  } finally {
    if(original)svgPrototype.getTotalLength=original;
    else delete svgPrototype.getTotalLength;
  }
 });

 it('removes unknown IDs with no ghost, disables effects explicitly, and honors reduced motion',()=>{
  const x=mount({deleteEffect:'none'});
  x.receive('a');
  expect(x.feed.removeMessage('missing')).toBe(false);
  expect(x.feed.removeMessage('a')).toBe(true);
  expect(document.querySelector('[data-chat-deletion-ghost]')).toBeNull();
  x.done();
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  const y=mount({deleteEffect:'mixed'});
  y.receive('b');y.feed.removeMessage('b');
  expect(document.querySelector('[data-chat-deletion-ghost]')).toBeNull();
  y.done();
 });

 it('keeps at most eight ghost visuals under rapid deletes and cancels them on clear/configure/dispose',()=>{
  const x=mount({deleteEffect:'mixed',maxActive:40});
  for(let i=0;i<20;i++){x.receive('m'+i);x.feed.removeMessage('m'+i);}
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(8);
  expect(x.root.querySelectorAll('.overlay-chat-message')).toHaveLength(0);
  expect(x.feed.snapshot()).toHaveLength(0);
  x.feed.configure({deleteEffect:'none'});
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(0);
  x.feed.configure({deleteEffect:'mixed'});
  x.receive('last');x.feed.removeMessage('last');
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(1);
  x.feed.clear();
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(0);
  x.done();
 });

 it('a ban cancels matching afterimages but leaves other viewers intact',()=>{
  const x=mount({deleteEffect:'mixed'});
  x.receive('alice','alice');x.receive('bob','bob');
  x.feed.removeMessage('alice');x.feed.removeMessage('bob');
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(2);
  x.feed.removeUser({username:'alice'});
  expect(document.querySelectorAll('[data-chat-deletion-ghost]')).toHaveLength(1);
  x.done();
 });

 it('uses the normalized Chat-only settings in URL and restores older presets',()=>{
  const options=normalizeOptions({...DEFAULT_OPTIONS,deleteEffect:'crumple',deleteMs:460});
  expect(readOptions('?'+writeOptions(options),'chat')).toEqual(options);
  expect(writeOptions(options,'wall')).not.toContain('deleteEffect');
  expect(normalizeOptions({deleteEffect:'invalid',deleteMs:9999}).deleteEffect).toBe('mixed');
  expect(normalizeOptions({deleteMs:9999}).deleteMs).toBe(700);
  expect(normalizeOptions({version:1,settings:{max:7}}).deleteEffect).toBe('mixed');
 });
});
