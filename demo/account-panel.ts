import {createYouTubeKeyControls} from './youtube-key-controls';
import {createServiceBadge} from '../src/renderers';

export type AccountMode='checking'|'local'|'hosted'|'preview'|'browser';
const providers=[
 {id:'twitch',name:'Twitch',description:'Anonymous IRC works without sign-in. A linked account enables authenticated EventSub chat in the local relay.'},
 {id:'kick',name:'Kick',description:'Live chat uses the anonymous realtime reader. Signing in links your Kick account; it does not change that chat transport.'},
 {id:'youtube',name:'YouTube',description:'Public live chat works without sign-in through an unofficial server reader. Local Google sign-in or a server API key uses the official YouTube connector instead.'},
 {id:'tiktok',name:'TikTok',description:'No sign-in needed. Uses the read-only public LIVE connector when the host enables it.'},
] as const;
type Provider=typeof providers[number]['id'];
type AccountStatus={configured:Partial<Record<Provider,boolean>>;connected:Partial<Record<Provider,boolean>>};

export function createAccountPanel({root,notice,feedback,fetcher=fetch,navigate=(url:string)=>location.assign(url)}:{
 root:HTMLElement;notice:HTMLElement;feedback:HTMLElement;fetcher?:typeof fetch;
 navigate?:(url:string)=>void;
}){
 let mode:AccountMode='checking',status:AccountStatus|null=null,loading=false,failed=false,revision=0,busy=false;
 const controller=new AbortController();
 const rows=providers.map(provider=>{
  const row=document.createElement('section');row.className='account-row';row.dataset.provider=provider.id;
  const heading=document.createElement('div');heading.className='account-row-heading';
  const logo=createServiceBadge(provider.id);if(logo){logo.setAttribute('aria-hidden','true');heading.append(logo);}
  const name=document.createElement('strong');name.textContent=provider.name;heading.append(name);
  const state=document.createElement('span');state.className='account-state';heading.append(state);
  const description=document.createElement('p');description.textContent=provider.description;
  const actions=document.createElement('div');actions.className='account-actions';
  row.append(heading,description,actions);root.append(row);
  return {provider,state,actions};
 });
 function render(){
  notice.textContent=mode==='checking'?'Checking relay availability…':mode==='hosted'
   ?'Account sign-in is available only in the local relay. This hosted editor uses server-managed credentials where required.'
   :mode==='browser'?'Twitch and Kick connect anonymously. YouTube has an optional API-key preview. Run pnpm live for anonymous YouTube, TikTok and account authorization.'
   :mode==='preview'?'No live relay is available in this preview. Run pnpm dev or pnpm live to manage local accounts.'
   :loading?'Checking local account status…':failed?'Could not read local account status. Close and reopen Accounts to retry.'
   :'Manage account authorization for the local relay. Accounts belong to a platform, not an individual channel.';
  for(const {provider,state,actions} of rows){
   actions.replaceChildren();
   const id=provider.id;
   if(mode==='browser'&&id==='youtube'){state.textContent='Optional API key';state.dataset.connected='false';createYouTubeKeyControls(actions);continue;}
   const connected=status?.connected[id]===true,configured=status?.configured[id]===true;
   const label=id==='tiktok'?'No sign-in':mode!=='local'?'Local authorization only':loading?'Checking…':!status?'Status unavailable':connected?'Signed in':configured?'Not signed in':'App not configured';
   state.textContent=label;state.dataset.connected=String(mode==='local'&&connected);
   if(id==='tiktok'||mode!=='local'||loading||!status)continue;
   if(!connected&&!configured)continue;
   const button=document.createElement('button');button.type='button';button.textContent=connected?'Sign out':'Sign in';
   button.setAttribute('aria-label',(connected?'Sign out of ':'Sign in to ')+provider.name);
   button.disabled=busy;
   button.addEventListener('click',()=>void change(id,connected),{signal:controller.signal});
   actions.append(button);
  }
 }
 async function refresh(){
  if(mode!=='local')return;
  const attempt=++revision;
  loading=true;failed=false;render();
  try{
   const response=await fetcher('/api/oauth/status',{signal:controller.signal});
   if(!response.ok)throw Error('Unavailable');
   const data=await response.json() as Partial<AccountStatus>&{mode?:string};
   if(data.mode!=='local'||!data.configured||!data.connected)throw Error('Invalid account status');
   if(attempt!==revision)return;
   status={configured:data.configured,connected:data.connected};
  }catch{if(attempt!==revision)return;status=null;failed=true;}
  finally{if(attempt===revision){loading=false;render();}}
 }
 async function change(provider:Provider,connected:boolean){
  if(mode!=='local'||provider==='tiktok'||busy||!status)return;
  busy=true;feedback.textContent=connected?'Signing out…':'Opening authorization…';render();
  try{
   const response=await fetcher('/api/oauth/'+(connected?'disconnect':'start'),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider}),signal:controller.signal,
   });
   const data=await response.json() as {url?:string;error?:string};
   if(!response.ok)throw Error(data.error??'Account request failed');
   if(!connected){
    if(!data.url)throw Error('Authorization URL unavailable');
    const url=new URL(data.url);
    if(url.protocol!=='https:')throw Error('Invalid authorization URL');
    navigate(url.href);return;
   }
   feedback.textContent='Account signed out.';
   await refresh();
  }catch(error){feedback.textContent=error instanceof Error?error.message:'Account request failed';}
  finally{busy=false;render();}
 }
 render();
 return {
  setMode(next:AccountMode){if(mode===next)return;++revision;mode=next;status=null;loading=false;failed=false;render();},
  refresh,
  dispose(){++revision;controller.abort();},
 };
}
