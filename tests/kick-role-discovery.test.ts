import {describe,expect,it,vi} from 'vitest';
import {createLiveHub,type LiveSource,type ServerPacket} from '../server/hub';
import {createKickBadgeCatalog,normalizeKickEvent,type ChatEvent} from '@myrqyry/chatbus';
import {createChatMessageElement} from '../src/renderers';
import {projectDisplayBadges} from '../src/chatbus';

const body='<path fill="#123456" d="M0 0h20v20H0Z"/>';

describe('Chatbus role artwork presentation',()=>{
 it('connects without waiting; late role artwork patches existing messages, native URLs win',async()=>{
  let callback!:(event:ChatEvent)=>void;
  let finish!:(value:{moderator:string})=>void;
  const load=vi.fn(()=>new Promise<{moderator:string}>(resolve=>{finish=resolve}));
  const source:LiveSource={connect(o){callback=o.onEvent;return {close(){}};},emotes:async()=>({emotes:{},complete:true})};
  const packets:ServerPacket[]=[];
  const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,
   ()=>createKickBadgeCatalog(async()=>({subscriber_badges:[]}),load));
  hub.connect('example','kick');
  const event=normalizeKickEvent({type:'ChatMessage',data:{id:'role',chatroom_id:42,content:'hi',created_at:'2026-11-10T06:00:00Z',sender:{id:17,username:'viewer',identity:{badges:[{type:'moderator',text:'Moderator'}]}}}},{channelName:'example'})!;
  callback(event);
  const initial=packets.find(p=>p.type==='event'&&p.event.type==='message');
  expect(initial).toMatchObject({event:{message:{user:{badges:[{text:'MOD'}]}}}});
  finish({moderator:body});await new Promise(r=>setTimeout(r,0));
  expect(packets).toContainEqual(expect.objectContaining({event:expect.objectContaining({type:'badges',messageId:'role',badges:[expect.objectContaining({text:'MOD',kickRoleSvg:body})]})}));
  callback({...event,message:{...event.message!,id:'native',user:{...event.message!.user,badges:[{id:'moderator',provider:'kick',scope:'native',images:[{url:'https://example.com/mod.png'}]}]}}});
  const native=packets.find(p=>p.type==='event'&&p.event.type==='message'&&p.event.message.id==='native');
  expect(native).toMatchObject({event:{message:{user:{badges:[{url:'https://example.com/mod.png'}]}}}});
  expect(JSON.stringify(native)).not.toContain('kickRoleSvg');
  hub.close();
 });
 it('projects normalized vectors without needing a provider lookup, and never mismatches gift counts',()=>{
  const badge={id:'sub_gifter',provider:'kick',version:'25',name:'Sub Gifter',svgBody:body,images:[]};
  expect(projectDisplayBadges([badge])).toEqual([{id:'sub_gifter',provider:'kick',name:'Sub Gifter',text:'GIFT 25',kickRoleSvg:body}]);
  expect(projectDisplayBadges([badge],[{provider:'kick',id:'sub_gifter',version:'26'}])).toEqual([{id:'sub_gifter',provider:'kick',name:'Sub Gifter',text:'GIFT 26'}]);
 });
 it('renders acquired artwork and falls back to semantic labels when invalid or broken',()=>{
  const message={id:'x',timestamp:1,user:{name:'a',badges:[{name:'Moderator',provider:'kick',id:'moderator',text:'MOD',kickRoleSvg:body}]},parts:[]};
  const row=createChatMessageElement(message);
  const image=row.querySelector<HTMLImageElement>('img.overlay-badge')!;
  expect(image.src).toMatch(/^data:image\/svg\+xml,/);
  image.dispatchEvent(new Event('error'));
  expect(row.querySelector('[data-badge-fallback]')?.textContent).toBe('MOD');
  const invalid=createChatMessageElement({...message,user:{...message.user,badges:[{...message.user.badges[0],kickRoleSvg:'<script/>'}]}});
  expect(invalid.querySelector('[data-badge-fallback]')?.textContent).toBe('MOD');
 });
});
