import {readBrowserYouTubeApiKey,saveBrowserYouTubeApiKey,forgetBrowserYouTubeApiKey} from '../src/youtube-browser-key';
export function createYouTubeKeyControls(root:HTMLElement){
 const form=document.createElement('form');form.className='youtube-key-controls';
 const help=document.createElement('p');
 help.textContent='Optional official API preview. In Google Cloud, enable YouTube Data API v3 and create a dedicated API key. Restrict it to YouTube Data API v3 and the website https://myrqyry.github.io/*. Never enter an unrestricted key or OAuth token. The key is stored in this browser profile, visible to its scripts, and sent only to Google. API quotas apply; every independent source polls separately.';
 const consoleLink=document.createElement('a');consoleLink.href='https://console.cloud.google.com/apis/credentials';consoleLink.target='_blank';consoleLink.rel='noopener noreferrer';consoleLink.textContent='Google Cloud credentials';
 const label=document.createElement('label');label.textContent='Restricted YouTube API key';
 const input=document.createElement('input');input.type='password';input.autocomplete='off';input.spellcheck=false;input.maxLength=104;input.placeholder='AIza…';label.append(input);
 const save=document.createElement('button');save.type='submit';save.textContent='Save key on this browser';
 const forget=document.createElement('button');forget.type='button';forget.textContent='Forget key';
 const status=document.createElement('p');status.setAttribute('role','status');
 const refresh=()=>{const configured=!!readBrowserYouTubeApiKey();status.textContent=configured?'A key is saved in this browser. Live access is not confirmed until connected.':'No key saved.';forget.disabled=!configured;};
 form.addEventListener('submit',event=>{event.preventDefault();try{saveBrowserYouTubeApiKey(input.value);input.value='';refresh();}catch(error){status.textContent=error instanceof Error?error.message:'Could not save key.';}});
 forget.addEventListener('click',()=>{try{forgetBrowserYouTubeApiKey();input.value='';refresh();}catch{status.textContent='Could not clear browser storage.';}});
 form.append(help,consoleLink,label,save,forget,status);root.append(form);refresh();
}
