import {createServiceBadge} from '../src/renderers';
import type {ViewerPlatform} from '../src/channel-choice';

const placeholders:Record<ViewerPlatform,string>={
  twitch:'Twitch username',kick:'Kick username',
  youtube:'YouTube live URL or video ID',tiktok:'TikTok username or LIVE URL',
};

/** A compact menu backed by the existing provider select, so connection
 * state, capability gating and source-chip selection keep one authority. */
export function createLivePlatformPicker({select,trigger,menu,channel}:{
  select:HTMLSelectElement;trigger:HTMLButtonElement;menu:HTMLElement;channel:HTMLInputElement;
}){
  const controller=new AbortController();
  const {signal}=controller;
  const options=Array.from(select.options);
  const buttons=options.map(option=>{
    const button=document.createElement('button');
    button.type='button';button.dataset.platform=option.value;
    button.setAttribute('role','menuitemradio');button.tabIndex=-1;
    const label=document.createElement('span');label.textContent=option.text;
    const logo=createServiceBadge(option.value);
    if(logo){logo.setAttribute('aria-hidden','true');button.append(logo);}
    button.append(label);menu.append(button);
    button.addEventListener('click',()=>{
      if(option.disabled)return;
      const changed=select.value!==option.value;
      select.value=option.value;
      close(true);sync();
      if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
    },{signal});
    return button;
  });
  function sync(){
    const option=select.selectedOptions[0];
    const platform=select.value as ViewerPlatform;
    const label=option?.text??'Chat platform';
    if(trigger.dataset.platform!==platform||!trigger.firstElementChild){
      const logo=createServiceBadge(platform);
      const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');
      chevron.setAttribute('viewBox','0 0 12 12');
      chevron.setAttribute('aria-hidden','true');
      chevron.classList.add('live-platform-chevron');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M2.5 4.5 6 8 9.5 4.5');
      path.setAttribute('fill','none');
      path.setAttribute('stroke','currentColor');
      path.setAttribute('stroke-width','1.7');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('stroke-linejoin','round');
      chevron.append(path);
      if(logo){logo.setAttribute('aria-hidden','true');trigger.replaceChildren(logo,chevron);}
      else trigger.replaceChildren(chevron);
      trigger.dataset.platform=platform;
    }
    trigger.setAttribute('aria-label','Chat platform: '+label);
    trigger.title='Choose chat platform ('+label+')';
    const channelHint=placeholders[platform]??'Channel';
    channel.placeholder=channelHint;
    channel.setAttribute('aria-label',channelHint);
    buttons.forEach((button,i)=>{
      button.disabled=options[i]!.disabled;
      button.setAttribute('aria-checked',String(options[i]!.value===select.value));
    });
    trigger.disabled=select.disabled||buttons.every(button=>button.disabled);
    if(trigger.disabled)close(false);
  }
  function enabled(){return buttons.filter(button=>!button.disabled);}
  function close(focus:boolean){
    menu.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(focus)trigger.focus();
  }
  function open(last=false){
    sync();
    const available=enabled();if(!available.length)return;
    menu.hidden=false;trigger.setAttribute('aria-expanded','true');
    (last?available.at(-1):available.find(button=>button.dataset.platform===select.value)??available[0])?.focus();
  }
  trigger.addEventListener('click',()=>menu.hidden?open():close(true),{signal});
  trigger.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open(event.key==='ArrowUp');}
  },{signal});
  menu.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true);return;}
    if(event.key==='Tab'){close(true);return;}
    const available=enabled();const index=available.indexOf(document.activeElement as HTMLButtonElement);
    let next:number;
    switch(event.key){
      case 'ArrowDown':next=(index+1)%available.length;break;
      case 'ArrowUp':next=(index+available.length-1)%available.length;break;
      case 'Home':next=0;break;
      case 'End':next=available.length-1;break;
      default:return;
    }
    event.preventDefault();available[next]?.focus();
  },{signal});
  document.addEventListener('pointerdown',event=>{
    if(!menu.hidden&&!menu.contains(event.target as Node)&&!trigger.contains(event.target as Node))close(false);
  },{signal});
  document.addEventListener('focusin',event=>{
    if(!menu.hidden&&!menu.contains(event.target as Node)&&!trigger.contains(event.target as Node))close(false);
  },{signal});
  select.addEventListener('change',sync,{signal});
  close(false);sync();
  return {sync,dispose(){close(false);controller.abort();menu.replaceChildren();}};
}
