import {createServiceBadge} from '../src/renderers';
import {sourceKey} from '../src/source-subscriptions';
import type {ViewerSource} from '../src/channel-choice';
import {hydrateMingcuteIcons} from './mingcute-icons';

export type SourceAction='reconnect'|'disconnect';
type Readiness={state:string;emotes:string;badges?:string;error?:string|null};
const labels={twitch:'Twitch',kick:'Kick',youtube:'YouTube',tiktok:'TikTok'};
const definitions=[['Connection','signal'],['Emotes','emoji'],['Badges','badge']] as const;
export function createLiveSourceChips({root,menu,onAction,onSelect}:{
 root:HTMLElement;menu:HTMLElement;onAction:(action:SourceAction,source:ViewerSource)=>void;
 onSelect:(source:ViewerSource)=>void;
}){
 const controller=new AbortController(),{signal}=controller;
 const entries=new Map<string,{source:ViewerSource;chip:HTMLButtonElement;dots:HTMLElement[]}>();
 let activeKey:string|null=null;
 const close=(focus=false)=>{
  const entry=activeKey?entries.get(activeKey):undefined;
  entry?.chip.setAttribute('aria-expanded','false');
  activeKey=null;menu.hidden=true;
  if(focus)entry?.chip.focus();
 };
 const title=document.createElement('div');title.className='live-source-menu-title';
 menu.append(title);
 for(const [action,label,icon] of [['reconnect','Reconnect','restore'],['disconnect','Disconnect','unlink']] as const){
  const button=document.createElement('button');button.type='button';button.dataset.action=action;
  button.setAttribute('role','menuitem');button.tabIndex=-1;
  const glyph=document.createElement('span');glyph.dataset.mingcute=icon;glyph.setAttribute('aria-hidden','true');
  const text=document.createElement('span');text.textContent=label;button.append(glyph,text);menu.append(button);
  button.addEventListener('click',()=>{
   const entry=activeKey?entries.get(activeKey):undefined;
   close(true);if(entry&&!entry.chip.disabled)onAction(action,entry.source);
  },{signal});
 }
 hydrateMingcuteIcons(menu);
 const position=()=>{
  const entry=activeKey?entries.get(activeKey):undefined;if(!entry)return;
  const box=entry.chip.getBoundingClientRect();
  menu.style.left=Math.max(4,Math.min(box.left,window.innerWidth-menu.offsetWidth-4))+'px';
  menu.style.top=Math.min(box.bottom+5,Math.max(4,window.innerHeight-menu.offsetHeight-4))+'px';
 };
 const open=(key:string)=>{
  if(activeKey===key){close(true);return;}
  close();
  const entry=entries.get(key);if(!entry||entry.chip.disabled)return;
  onSelect(entry.source);
  activeKey=key;entry.chip.setAttribute('aria-expanded','true');
  title.textContent=labels[entry.source.platform]+' · '+entry.source.channel;
  menu.hidden=false;position();
  menu.querySelector<HTMLButtonElement>('button')?.focus();
 };
 menu.addEventListener('keydown',event=>{
  const items=Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
  if(event.key==='Escape'){event.preventDefault();close(true);}
  else if(event.key==='Tab')close(true);
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
   event.preventDefault();const index=items.indexOf(document.activeElement as HTMLButtonElement);
   items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+items.length+(event.key==='ArrowDown'?1:-1))%items.length]?.focus();
  }
 },{signal});
 document.addEventListener('pointerdown',event=>{
  if(activeKey&&!menu.contains(event.target as Node)&&!entries.get(activeKey)?.chip.contains(event.target as Node))close();
 },{signal});
 document.addEventListener('focusin',event=>{
  if(activeKey&&!menu.contains(event.target as Node)&&!entries.get(activeKey)?.chip.contains(event.target as Node))close();
 },{signal});
 window.addEventListener('resize',()=>close(),{signal});
 root.addEventListener('scroll',()=>close(),{signal});
 return {
  render(sources:readonly ViewerSource[],statuses:ReadonlyMap<string,Readiness>,selected:ViewerSource|null,busy:ReadonlySet<string>){
   const wanted=new Set(sources.map(sourceKey));
   for(const [key,entry] of entries)if(!wanted.has(key)){
    if(activeKey===key)close();entry.chip.remove();entries.delete(key);
   }
   for(const source of sources){
    const key=sourceKey(source);
    let entry=entries.get(key);
    if(!entry){
     const chip=document.createElement('button');chip.type='button';chip.className='live-source-chip';
     chip.dataset.platform=source.platform;chip.dataset.sourceId=key;
     chip.setAttribute('aria-haspopup','menu');chip.setAttribute('aria-controls',menu.id);chip.setAttribute('aria-expanded','false');
     const service=document.createElement('span');service.className='live-source-chip-service';
     const logo=createServiceBadge(source.platform);if(logo){logo.setAttribute('aria-hidden','true');service.append(logo);}
     const label=document.createElement('span');label.className='live-source-chip-label';label.textContent=source.channel;
     const group=document.createElement('span');group.className='live-chip-readiness';
     const dots=definitions.map(([,icon])=>{const dot=document.createElement('span');dot.className='live-status-dot';dot.dataset.mingcute=icon;group.append(dot);return dot;});
     chip.append(service,label,group);hydrateMingcuteIcons(chip);
     chip.addEventListener('click',()=>open(key),{signal});
     chip.addEventListener('contextmenu',e=>{e.preventDefault();if(activeKey!==key)open(key);},{signal});
     chip.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&activeKey!==key){e.preventDefault();open(key);}},{signal});
     entry={source,chip,dots};entries.set(key,entry);root.append(chip);
    }
    const status=statuses.get(key);
    const states=[status?.state??'connecting',status?.emotes??'idle',status?.badges??'idle'];
    const description=definitions.map(([label],i)=>label+': '+states[i]);
    entry.chip.dataset.selected=String(selected!==null&&sourceKey(selected)===key);
    entry.chip.disabled=busy.has(key);
    entry.chip.title=labels[source.platform]+' '+source.channel+' · '+description.join(' · ')+(status?.error?' · '+status.error:'');
    entry.chip.setAttribute('aria-label',entry.chip.title+' · Source actions');
    entry.dots.forEach((dot,i)=>{dot.dataset.state=states[i];dot.title=description[i]!;dot.setAttribute('aria-label',description[i]!);});
    if(entry.chip.disabled&&activeKey===key)close();
   }
  },
  dispose(){close();controller.abort();root.replaceChildren();menu.replaceChildren();entries.clear();},
 };
}
