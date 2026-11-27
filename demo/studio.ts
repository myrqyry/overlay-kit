import {watchBrowserYouTubeKey} from '../src/youtube-browser-key';
import type {BrowserPreviewPacket} from '../src/browser-preview-packets';
import {getPreferredLiveCapability,connectPreferredSource} from '../src/browser-live-client';
import { createOverlayBridge } from '../src/bridge';
import { connectLiveSource, type WireLiveStatus } from '../src/live-client';
import {createSourceSubscriptions,sourceKey} from '../src/source-subscriptions';
import {createLiveSourceChips,type SourceAction} from './live-source-chips';
import {normalizeViewerChannel,normalizeViewerPlatform,restoreHostedViewerSources,withViewerSources,type ViewerPlatform,type ViewerSource} from '../src/channel-choice';
import {updatePreviewFrame,suspendPreviewFrame} from '../src/preview-settings';
import { sampleMessage } from './sample';
import {createPreviewAssetLibrary} from '../src/preview-asset-cache';
import type {OverlayLiveEvent} from '../src/live';
import { sampleSocialSignal } from './sample-events';
import {createAccountPanel} from './account-panel';
import {createWorkspaceTabActions} from './workspace-tab-actions';
import {createLivePlatformPicker} from './live-platform-picker';
import {createGoogleFontPicker} from './font-picker';
import {createEventOverridesEditor} from './event-overrides-editor';
import {parseTriggerRules,starterTriggerRules} from '../src/overlay-triggers';
import { restoreSeparateSettings, migrateLegacyWall } from '../src/editor-settings';
import {restorePreviewEnabled} from '../src/preview-enabled';
import {createEditorBackup,parseEditorBackup} from '../src/editor-backup';
import {hydrateMingcuteIcons} from './mingcute-icons';
import {sectionCue,optionCue} from './editor-visual-cues';
import {
  DEFAULT_OPTIONS, normalizeOptions, OPTION_DEFINITIONS,
  OPTIONS_VERSION, PRESETS, writeOptions, optionsForEditor, isOptionApplicable,
  type OverlayOptions, type OptionDefinition, type OverlayEditorView,
} from '../src/options';
import './styles.css';

function input<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing editor control: ' + id);
  return element as T;
}
const wall = input<HTMLIFrameElement>('wall-preview');
const chat = input<HTMLIFrameElement>('chat-preview');
const avatars = input<HTMLIFrameElement>('avatars-preview');
const events = input<HTMLIFrameElement>('events-preview');
const status = input<HTMLElement>('status');
const sampleAssetStatus=input<HTMLElement>('sample-asset-status');
const clearSampleAssets=input<HTMLButtonElement>('clear-sample-assets');
const sampleAssets=createPreviewAssetLibrary();
const updateSampleAssetStatus=()=>{
  const profiles=sampleAssets.profiles();
  const paints=profiles.filter(profile=>profile.paint).length;
  const badges=profiles.reduce((count,profile)=>count+profile.badges.length,0);
  const emotes=profiles.reduce((count,profile)=>count+profile.emotes.length,0);
  sampleAssetStatus.textContent=profiles.length
    ?profiles.length+' real chat visual samples · '+emotes+' emotes · '+badges+' badges · '+paints+' paints'
    :'Local demo artwork and test paints · No real Chatbus cosmetics cached yet';
  clearSampleAssets.disabled=profiles.length===0;
};
const recordSampleAssets=(event:OverlayLiveEvent)=>{
  if(sampleAssets.observe(event))updateSampleAssetStatus();
};
clearSampleAssets.addEventListener('click',()=>{
  sampleAssets.clear();updateSampleAssetStatus();
  for(const frame of [wall,chat,avatars]){
    if(frame.src!=='about:blank')frame.contentWindow?.postMessage({type:'overlay-kit-preview-assets-reset'},location.origin);
  }
  status.textContent='Cached preview artwork cleared. New live chat can populate it again.';
});
updateSampleAssetStatus();
const linkWall = input<HTMLAnchorElement>('wall-url');
const linkChat = input<HTMLAnchorElement>('chat-url');
const linkAvatars = input<HTMLAnchorElement>('avatars-url');
const linkEvents = input<HTMLAnchorElement>('events-url');
const groups = input<HTMLElement>('options-root');
const presetSelect = input<HTMLSelectElement>('preset-select');
const nameInput = input<HTMLInputElement>('preset-name');
const loadPresetButton=input<HTMLButtonElement>('load-preset');
const deletePresetButton=input<HTMLButtonElement>('delete-preset');
const importAllButton=input<HTMLButtonElement>('import-all-settings');
const exportAllButton=input<HTMLButtonElement>('export-all-settings');
const importAllFile=input<HTMLInputElement>('import-all-file');
const search = input<HTMLInputElement>('search-options');
const livePlatform=input<HTMLSelectElement>('live-platform');
const liveChannel = input<HTMLInputElement>('live-channel');
const liveToggle = input<HTMLButtonElement>('live-toggle');
const platformPicker=createLivePlatformPicker({select:livePlatform,channel:liveChannel,
  trigger:input<HTMLButtonElement>('live-platform-trigger'),menu:input<HTMLElement>('live-platform-menu')});
const liveToggleIcon = input<HTMLElement>('live-toggle-icon');
const liveStatus = input<HTMLElement>('live-status');
const liveSources = input<HTMLElement>('live-sources');
const accountsDialog=input<HTMLDialogElement>('accounts-dialog');
const accountPanel=createAccountPanel({root:input('accounts-list'),notice:input('accounts-notice'),feedback:input('accounts-feedback')});
input<HTMLButtonElement>('open-accounts').addEventListener('click',()=>{
  accountsDialog.showModal();void accountPanel.refresh();
});
accountsDialog.addEventListener('click',event=>{if(event.target===accountsDialog)accountsDialog.close();});
hydrateMingcuteIcons();
let liveFeed: {dispose():void} | null = null;
let activeLiveSources:ViewerSource[]=[];
let hostedLive=false;
let directBrowserLive=false;
let liveCapabilityKnown=false;
let hostedSession:ReturnType<typeof createSourceSubscriptions<WireLiveStatus>>|null=null;
const sourceStatuses=new Map<string,WireLiveStatus>();
const busySources=new Set<string>();
const HOSTED_CHANNEL_KEY='myrqyry-overlay-kit-selected-channel-v1';
const HOSTED_PLATFORM_KEY='myrqyry-overlay-kit-selected-platform-v1';
const HOSTED_SOURCES_KEY='myrqyry-overlay-kit-selected-sources-v2';
let selectedHostedPlatform:ViewerPlatform='twitch';
let selectedHostedChannel:string|null=null;
let selectedHostedSources:ViewerSource[]=[];
let storedHostedSources:string|null=null;
try{
  selectedHostedPlatform=normalizeViewerPlatform(localStorage.getItem(HOSTED_PLATFORM_KEY))??'twitch';
  selectedHostedChannel=normalizeViewerChannel(localStorage.getItem(HOSTED_CHANNEL_KEY),selectedHostedPlatform);
  storedHostedSources=localStorage.getItem(HOSTED_SOURCES_KEY);
}catch{/* Optional browser storage. */}

let supportedLivePlatforms:ViewerPlatform[]=[];
function draftSource():ViewerSource|null{
  const platform=normalizeViewerPlatform(livePlatform.value)??'twitch';
  if(!supportedLivePlatforms.includes(platform))return null;
  const channel=normalizeViewerChannel(liveChannel.value,platform);
  return channel?{platform,channel}:null;
}
function includesSource(sources:readonly ViewerSource[],source:ViewerSource|null):boolean{
  return Boolean(source&&sources.some(item=>sourceKey(item)===sourceKey(source)));
}
const sourceChips=createLiveSourceChips({
  root:liveSources,menu:input<HTMLElement>('live-source-menu'),
  onSelect(source){
    livePlatform.value=source.platform;liveChannel.value=source.channel;
    if(hostedLive){selectedHostedPlatform=source.platform;selectedHostedChannel=source.channel;}

    if(hostedLive)syncHostedControls();else syncLocalControls();
  },
  onAction(action,source){void commandLive(action,source);},
});
function renderSourceChips(sources:readonly ViewerSource[]){
  sourceChips.render(sources,sourceStatuses,draftSource(),busySources);
}
function setLiveToggle(connected:boolean,enabled=true){
  const action=connected?'disconnect':'connect';
  liveToggle.dataset.action=action;
  liveToggle.setAttribute('aria-label',connected?'Remove selected chat source':'Add selected chat source');
  liveToggle.title=connected?'Remove selected chat source':'Add selected chat source';
  liveToggle.disabled=!enabled;
  liveToggleIcon.dataset.mingcute=connected?'unlink':'link';
  hydrateMingcuteIcons(liveToggle);
}
function syncHostedControls(){
  if(!hostedLive)return;
  platformPicker.sync();
  const draft=draftSource();
  setLiveToggle(includesSource(selectedHostedSources,draft),Boolean(draft&&!busySources.has(sourceKey(draft))));
  renderSourceChips(selectedHostedSources);
}
function syncLocalControls(){
  platformPicker.sync();
  const draft=draftSource();
  setLiveToggle(includesSource(activeLiveSources,draft),Boolean(draft&&!busySources.has(sourceKey(draft))));
  renderSourceChips(activeLiveSources);
}
function renderLive(status:WireLiveStatus) {
  if(!hostedLive){
    sourceStatuses.clear();
    activeLiveSources=(status.sources??(status.platform&&status.channel?[status]:[])).flatMap(item=>{
      const platform=normalizeViewerPlatform(item.platform);
      const channel=platform?normalizeViewerChannel(item.channel,platform):null;
      if(!platform||!channel)return [];
      const source={platform,channel};
      sourceStatuses.set(sourceKey(source),item);
      return [source];
    });
  }
  if(hostedLive)syncHostedControls();else syncLocalControls();
  const sources=hostedLive?selectedHostedSources:activeLiveSources;
  liveStatus.textContent=sources.length
    ? sources.map(source=>{
        const detail=sourceStatuses.get(sourceKey(source));
        return source.platform+' '+source.channel+': '+(detail?.state??'connecting')
          +' · Emotes: '+(detail?.emotes??'idle')+' · Badges: '+(detail?.badges??'idle')
          +(detail?.error?' · '+detail.error:'');
      }).join('; ')
    : directBrowserLive?'Browser-direct Twitch and Kick. YouTube: optional API key in Accounts. TikTok: local relay.':'Disconnected. Add a live-chat source.';
}
async function commandLive(action: 'connect'|SourceAction,target?:ViewerSource) {
  const platform=target?.platform??normalizeViewerPlatform(livePlatform.value)??'twitch';
  if(!supportedLivePlatforms.includes(platform))return;
  const requested=target?.channel??normalizeViewerChannel(liveChannel.value,platform);
  if(!requested){
    liveStatus.textContent=platform==='youtube'
      ? 'Enter a YouTube live video URL or 11-character video ID.'
      : platform==='kick'?'Enter a valid Kick channel slug.'
      : platform==='tiktok'?'Enter a TikTok @username or LIVE URL.'
      : 'Enter a Twitch channel (letters, numbers, underscores only).';
    return;
  }
  const selected={platform,channel:requested} satisfies ViewerSource;
  const key=sourceKey(selected);
  if(busySources.has(key))return;
  if(hostedLive){
    if(action==='reconnect'){
      if(!includesSource(selectedHostedSources,selected))return;
      sourceStatuses.delete(key);
      hostedSession?.reconnect(selected);
      sendHostedSources(selected);
      syncHostedControls();
      return;
    }
    if(action==='connect'&&!includesSource(selectedHostedSources,selected))selectedHostedSources.push(selected);
    if(action==='disconnect')selectedHostedSources=selectedHostedSources.filter(item=>sourceKey(item)!==sourceKey(selected));
    if(action==='disconnect'&&selectedHostedPlatform===platform&&selectedHostedChannel===requested){
      const next=selectedHostedSources[0];
      selectedHostedPlatform=next?.platform??platform;
      selectedHostedChannel=next?.channel??null;
      if(next){livePlatform.value=next.platform;liveChannel.value=next.channel;}
    }else{
      selectedHostedPlatform=platform;selectedHostedChannel=requested;
      livePlatform.value=platform;liveChannel.value=requested;
    }
    try{
      localStorage.setItem(HOSTED_PLATFORM_KEY,selectedHostedPlatform);
      if(selectedHostedChannel)localStorage.setItem(HOSTED_CHANNEL_KEY,selectedHostedChannel);
      else localStorage.removeItem(HOSTED_CHANNEL_KEY);
      localStorage.setItem(HOSTED_SOURCES_KEY,JSON.stringify(selectedHostedSources));
    }catch{/* Browser storage is optional. */}
    hostedSession?.sync(selectedHostedSources);
    refresh();sendHostedSources();syncHostedControls();
    return;
  }
  busySources.add(key);syncLocalControls();
  liveStatus.textContent=action==='connect'?'Adding chat source…':action==='reconnect'?'Reconnecting chat source…':'Removing chat source…';
  try{
    const response=await fetch('/api/live/'+action,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(action==='connect'
        ? {platform,channel:requested,combine:true}
        : {platform,channel:requested}),
    });
    const data:unknown=await response.json();
    const packet=data as {status?:WireLiveStatus;error?:string};
    if(!response.ok||!packet.status)throw Error(packet.error??'Live relay unavailable');
    renderLive(packet.status);
  }catch(error){
    liveStatus.textContent=error instanceof Error?error.message:'Live connection request failed';
  }finally{busySources.delete(key);syncLocalControls();}
}
liveToggle.addEventListener('click',()=>{
  void commandLive(liveToggle.dataset.action==='disconnect'?'disconnect':'connect');
});
liveChannel.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!liveToggle.disabled)
    void commandLive(liveToggle.dataset.action==='disconnect'?'disconnect':'connect');
});
liveChannel.addEventListener('input',()=>{
  if(hostedLive)syncHostedControls();
  else syncLocalControls();
});
livePlatform.addEventListener('change',()=>{

  const platform=normalizeViewerPlatform(livePlatform.value)??'twitch';
  const normalized=normalizeViewerChannel(liveChannel.value,platform);
  if(!normalized)liveChannel.value='';else liveChannel.value=normalized;
  if(hostedLive){selectedHostedPlatform=platform;selectedHostedChannel=normalized;syncHostedControls();}
  else syncLocalControls();
});
void getPreferredLiveCapability().then(async capability=>{
  liveCapabilityKnown=true;
  accountPanel.setMode(capability?.mode??'preview');
  const oauthResult=new URLSearchParams(location.search).get('oauth');
  if(capability?.mode==='local'&&(oauthResult==='connected'||oauthResult==='failed')){
    input('accounts-feedback').textContent=oauthResult==='connected'?'Account authorized.':'Account authorization did not complete.';
    if(!accountsDialog.open)accountsDialog.showModal();
    const url=new URL(location.href);url.searchParams.delete('oauth');history.replaceState(null,'',url.href);
  }
  if(accountsDialog.open)void accountPanel.refresh();
  if(!capability){
    liveStatus.textContent='Live Chatbus requires a local relay (pnpm live); this hosted editor supports previews.';
    setLiveToggle(false,false);
    refresh(undefined,true);
    return;
  }
  supportedLivePlatforms=capability.platforms;
  for(const option of Array.from(livePlatform.options))option.disabled=!supportedLivePlatforms.includes(option.value as ViewerPlatform);
  if(!supportedLivePlatforms.includes(livePlatform.value as ViewerPlatform))livePlatform.value=capability.platform;
  platformPicker.sync();
  if(capability.mode==='hosted'||capability.mode==='browser'){
    hostedLive=true;
    directBrowserLive=capability.mode==='browser';
    liveStatus.textContent=directBrowserLive?'Browser-direct Twitch and Kick. YouTube: optional API key in Accounts. TikTok: local relay.':'Disconnected. Add a live-chat source.';

    const defaultChannel=normalizeViewerChannel(capability.channel,capability.platform);
    selectedHostedSources=restoreHostedViewerSources(
      storedHostedSources,
      selectedHostedChannel?{platform:selectedHostedPlatform,channel:selectedHostedChannel}:null,
      defaultChannel?{platform:capability.platform,channel:defaultChannel}:null,
      capability.platforms,
    );
    if(!capability.platforms.includes(selectedHostedPlatform))selectedHostedPlatform=capability.platform;
    const initial=selectedHostedSources.find(source=>source.platform===selectedHostedPlatform&&source.channel===selectedHostedChannel)
      ?? selectedHostedSources[0];
    if(initial){selectedHostedPlatform=initial.platform;selectedHostedChannel=initial.channel;}
    else selectedHostedChannel=null;
    livePlatform.value=selectedHostedPlatform;
    liveChannel.value=selectedHostedChannel??'';
    platformPicker.sync();
    renderSourceChips(selectedHostedSources);
    hostedSession=createSourceSubscriptions<WireLiveStatus>(
      (source,receive)=>connectPreferredSource(capability,source,event=>{
        recordSampleAssets(event);publishBrowserPreviewPacket(source,{type:'event',value:event});
      },status=>{receive(status);publishBrowserPreviewPacket(source,{type:'status',value:status});},
      signal=>publishBrowserPreviewPacket(source,{type:'signal',value:signal})),
      (source,status)=>{
        const detail=status.sources?.find(item=>item.platform===source.platform&&item.channel===source.channel)??status;
        sourceStatuses.set(sourceKey(source),detail);
        renderLive(status);
      },
      source=>sourceStatuses.delete(sourceKey(source)),
    );
    refresh(undefined,true);
    hostedSession.sync(selectedHostedSources);
    syncHostedControls();
    return;
  }

  try{
    const response=await fetch('/api/live/status');
    const packet=await response.json() as {status:WireLiveStatus};
    renderLive(packet.status);
    if(activeLiveSources.length===1){
      livePlatform.value=activeLiveSources[0]!.platform;
      liveChannel.value=activeLiveSources[0]!.channel;

    }
    syncLocalControls();
  }catch{
    liveStatus.textContent='Could not read Chatbus status.';
    syncLocalControls();
  }
  refresh(undefined,true);
  liveFeed=connectLiveSource(recordSampleAssets,status=>renderLive(status));
});
const FILE_KEY = 'myrqyry-overlay-kit-presets-v1';
const CURRENT_KEY = 'myrqyry-overlay-kit-settings-v1'; // Legacy workspace, read only
const CURRENT_SEPARATE_KEY = 'myrqyry-overlay-kit-independent-settings-v1';
const EDITOR_VIEW_KEY = 'myrqyry-overlay-kit-active-editor-v1';
function storedEditor(): OverlayEditorView {
  try { const saved=localStorage.getItem(EDITOR_VIEW_KEY);return saved==='chat'||saved==='avatars'||saved==='events'?saved:'wall'; }
  catch { return 'wall'; }
}
let selectedView: OverlayEditorView = storedEditor();
const editorButtons = {
  wall: input<HTMLButtonElement>('edit-wall'),
  chat: input<HTMLButtonElement>('edit-chat'),
  avatars: input<HTMLButtonElement>('edit-avatars'),
  events: input<HTMLButtonElement>('edit-events'),
};
const previewCards = {
  wall: input<HTMLElement>('wall-preview').closest<HTMLElement>('.preview-card'),
  chat: input<HTMLElement>('chat-preview').closest<HTMLElement>('.preview-card'),
  avatars: input<HTMLElement>('avatars-preview').closest<HTMLElement>('.preview-card'),
  events: input<HTMLElement>('events-preview').closest<HTMLElement>('.preview-card'),
};
const workspace = input<HTMLElement>('workspace');
const studio = input<HTMLElement>('studio');
const showSettings = input<HTMLButtonElement>('show-settings');
const showPreview = input<HTMLButtonElement>('show-preview');
const previewGrid = input<HTMLElement>('preview-grid');
const compareButton = input<HTMLButtonElement>('compare-previews');
const presetsDialog=input<HTMLDialogElement>('presets-dialog');
const resetConfirmation=input<HTMLElement>('preset-reset-confirm');
const resetButton=input<HTMLButtonElement>('reset-defaults');
const viewNames:Record<OverlayEditorView,string>={wall:'Emote wall',chat:'Chat',avatars:'Avatars',events:'Events'};
const sourceLinkDialog=input<HTMLDialogElement>('source-link-dialog');
const manualSourceLink=input<HTMLInputElement>('manual-source-link');
const TAB_VIEWS=['wall','chat','avatars','events'] as const;
const PREVIEW_ENABLED_KEY='myrqyry-overlay-kit-preview-enabled-v1';
let persistedEnabled:string|null=null;
try{persistedEnabled=localStorage.getItem(PREVIEW_ENABLED_KEY);}
catch{/* Storage may be unavailable in OBS; use fresh defaults. */}
const enabledPreviews=restorePreviewEnabled(persistedEnabled);
const tabActions=createWorkspaceTabActions(input('workspace-tab-actions'),editorButtons);
for(const view of TAB_VIEWS){
  const toggle=input<HTMLInputElement>('enable-'+view);
  toggle.checked=enabledPreviews[view];
  toggle.addEventListener('change',()=>{
    enabledPreviews[view]=toggle.checked;
    saveObject(PREVIEW_ENABLED_KEY,enabledPreviews);
    syncPreviewAvailability();
    refresh(view);
  });
}
const copyTimers=new Map<HTMLAnchorElement,ReturnType<typeof setTimeout>>();
for(const link of [linkWall,linkChat,linkAvatars,linkEvents]){
  const label=link.querySelector<HTMLElement>('.copy-label')!;
  const original=label.textContent!;
  link.addEventListener('click',async event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
    const url=link.href;
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      label.textContent='Copied';link.dataset.copied='true';
      input('source-copy-feedback').textContent=viewNames[link.dataset.view as OverlayEditorView]+' browser-source link copied.';
      clearTimeout(copyTimers.get(link));
      copyTimers.set(link,setTimeout(()=>{label.textContent=original;delete link.dataset.copied;copyTimers.delete(link);},1400));
    }catch{
      manualSourceLink.value=url;
      if(!sourceLinkDialog.open)sourceLinkDialog.showModal();
      manualSourceLink.focus();manualSourceLink.select();
    }
  });
}
input<HTMLButtonElement>('open-presets').addEventListener('click',()=>{
  input('presets-title').textContent=viewNames[selectedView]+' presets';
  input('preset-feedback').textContent='';
  resetConfirmation.hidden=true;
  presetsDialog.showModal();
});
presetsDialog.addEventListener('close',()=>{resetConfirmation.hidden=true;});
input<HTMLButtonElement>('cancel-reset').addEventListener('click',()=>{
  resetConfirmation.hidden=true;resetButton.focus();
});
resetButton.addEventListener('click',()=>{
  input('preset-reset-warning').textContent='Reset '+viewNames[selectedView]+' current edits to defaults? Named presets and other overlays are kept.';
  resetConfirmation.hidden=false;
  input<HTMLButtonElement>('cancel-reset').focus();
});
let comparing = false;
const custom: Record<OverlayEditorView, Map<string,OverlayOptions>> = {
  chat: new Map(), wall: new Map(), avatars: new Map(), events: new Map(),
};

function notify(message: string) { status.textContent = message; if(presetsDialog.open)input('preset-feedback').textContent=message; }
function loadObject(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown; }
  catch { return null; }
}
function saveObject(key: string, data: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch { notify('Browser settings storage is unavailable.'); return false; }
}
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
// Preserve old fifth-view edits before four-view state is rewritten. This
// one-time browser-local archive is not a game runtime module.
// The sibling project cannot silently read storage on another origin/port.
const oldSettings=loadObject(CURRENT_SEPARATE_KEY);
if(isObject(oldSettings)&&isObject(oldSettings.pusher)){
  try{
    const archiveKey='myrqyry-emote-pusher-extracted-v1';
    if(!localStorage.getItem(archiveKey)){
      const previous=loadObject(FILE_KEY);
      const prevPresets=isObject(previous)&&isObject(previous.presets)&&isObject(previous.presets.pusher)
        ?previous.presets.pusher:{};
      localStorage.setItem(archiveKey,JSON.stringify({
        version:1,settings:oldSettings.pusher,presets:prevPresets,
      }));
    }
  }catch{/* Do not block the remaining overlays if storage is unavailable. */}
}
const saved = loadObject(FILE_KEY);
if (isObject(saved) && saved.version === OPTIONS_VERSION && isObject(saved.presets)) {
  const presets = saved.presets;
  const separated = saved.format === 'per-overlay' && isObject(presets.chat) && isObject(presets.wall);
  for (const view of ['chat','wall','avatars','events'] as const) {
    const records = separated ? presets[view] : presets;
    if (!isObject(records)) continue;
    for (const [name,value] of Object.entries(records)) {
      if (!name || name.length > 40 || Object.hasOwn(PRESETS,name)) continue;
      try { custom[view].set(name, view === 'wall' && !separated
        ? migrateLegacyWall(value) : normalizeOptions(value)); }
      catch { /* invalid saved entry */ }
    }
  }
}
const restored = restoreSeparateSettings(
  loadObject(CURRENT_KEY), loadObject(CURRENT_SEPARATE_KEY), location.search, selectedView,
);
const current = {chat: restored.chat, wall: restored.wall, avatars: restored.avatars, events:restored.events};
if (restored.importedView) selectedView = restored.importedView;
let settings = current[selectedView];
const persistCurrent = () => {
  current[selectedView] = settings;
  return saveObject(CURRENT_SEPARATE_KEY, {version:OPTIONS_VERSION,chat:current.chat,wall:current.wall,avatars:current.avatars,events:current.events});
};
// Persist legacy migration without ever overwriting the legacy source.
if (persistCurrent() && restored.importedFromUrl) {
  const url = new URL(location.href);
  url.search = restored.remainingSearch;
  history.replaceState(history.state, '', url);
}
const controls = new Map<keyof OverlayOptions, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
let fontPicker:ReturnType<typeof createGoogleFontPicker>|null=null;
let overridesEditor:ReturnType<typeof createEventOverridesEditor>|null=null;
const sections = new Map<string, HTMLDetailsElement>();
const labels = new Map<string, HTMLElement>();
const cueRows=new Map<keyof OverlayOptions,HTMLElement>();
const ruleDiagnostics=new Map<keyof OverlayOptions,()=>void>();

function format(def: OptionDefinition, value: string | boolean | number) {
  if(def.key==='usernameSize' && Number(value)===0)return 'Match';
  if(def.kind==='overrides'||def.kind==='trigger-rules')return '';
  return def.kind === 'toggle' || def.kind === 'user-list' ? '' : String(value) + (def.unit ?? '');
}
for (const def of OPTION_DEFINITIONS) {
  let section = sections.get(def.section);
  if (!section) {
    section = document.createElement('details');
    section.className = 'option-section';
    const [scope, title = scope] = def.section.split(' • ');
    section.dataset.scope = scope.toLowerCase();
    const sectionVisual=sectionCue(def.section);
    section.dataset.cueTone=sectionVisual.tone;
    section.open = sections.size === 0 || def.section === 'Chat • Typography' || def.section === 'Chat • Badges' || def.section === 'Wall • Movement';
    const summary = document.createElement('summary');
    const summaryMarker = document.createElement('span');
    summaryMarker.className = 'option-section-marker';
    summaryMarker.dataset.mingcute=sectionVisual.icon;
    summaryMarker.setAttribute('aria-hidden','true');
    const summaryTitle = document.createElement('span');
    summaryTitle.className = 'option-section-title';
    summaryTitle.textContent = title;
    summary.append(summaryMarker, summaryTitle);
    section.append(summary);
    groups.append(section);
    sections.set(def.section, section);
  }
  const row = document.createElement(def.kind==='font'||def.kind==='overrides'||def.kind==='trigger-rules'?'div':'label');
  row.className = 'option-row';
  row.dataset.optionKey = def.key;
  row.dataset.searchText = (def.section + ' ' + def.label + ' ' + def.hint).toLowerCase();
  const heading = document.createElement('span');
  heading.className = 'option-heading';
  const headingLabel=document.createElement('span');
  headingLabel.className='option-heading-label';
  headingLabel.textContent = def.label;
  const visual=optionCue(def.key);
  if(visual){
    row.dataset.cueTone=visual.tone;
    const mark=document.createElement('span');
    mark.className='option-cue-icon';
    mark.dataset.mingcute=visual.icon;
    mark.setAttribute('aria-hidden','true');
    heading.append(mark);
    cueRows.set(def.key,row);
  }
  heading.append(headingLabel);
  const help = document.createElement('span');
  help.className = 'option-help-trigger';
  help.tabIndex = 0;
  help.setAttribute('role', 'note');
  help.setAttribute('aria-label', 'About ' + def.label);
  help.textContent = 'ⓘ';
  const tooltip = document.createElement('span');
  tooltip.className = 'option-help-tooltip';
  tooltip.id = 'opt-hint-' + def.key;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.textContent = def.hint;
  help.append(tooltip);
  // The row is a wrapping label. Clicking help must never toggle the setting.
  help.addEventListener('click', event => event.preventDefault());
  heading.append(help);
  const output = document.createElement('output');
  output.className = 'option-value';
  labels.set(def.key, output);
  heading.append(output);
  row.append(heading);
  let control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if(def.kind==='overrides'){
    const hidden=document.createElement('input');
    hidden.type='hidden';
    control=hidden;
  } else if(def.kind==='font'){
    fontPicker=createGoogleFontPicker(value=>{
      settings=normalizeOptions({...settings,googleFont:value});
      syncControls();
      persistCurrent();
      refresh(selectedView);
    });
    control=fontPicker.input;
  } else if (def.kind === 'select') {
    const select = document.createElement('select');
    for (const choice of def.choices ?? []) {
      const opt = document.createElement('option');
      opt.value = choice.value;
      opt.textContent = choice.label;
      select.append(opt);
    }
    control = select;
  } else if(def.kind==='trigger-rules'){
    const field=document.createElement('textarea');
    field.rows=6;field.maxLength=2500;field.spellcheck=false;
    field.className='trigger-rules-input';
    field.placeholder='!hype -> confetti @mods 6s\nraid -> spotlight 8s';
    control=field;
  } else {
    const field = document.createElement('input');
    field.type = def.kind === 'toggle' ? 'checkbox' : def.kind === 'user-list' ? 'text' : 'range';
    if (def.kind === 'range') {
      field.min = String(def.min);
      field.max = String(def.max);
      field.step = String(def.step ?? 1);
    } else if(def.kind==='user-list') {
      field.maxLength=1024;
      field.autocomplete='off';
      field.spellcheck=false;
    }
    control = field;
  }
  control.id = 'opt-' + def.key;
  control.setAttribute('aria-label', def.label);
  control.setAttribute('aria-describedby', tooltip.id);
  row.classList.toggle('toggle-option', def.kind === 'toggle');
  if(def.kind==='font')row.append(fontPicker!.element);
  else row.append(control);
  section.append(row);
  controls.set(def.key, control);
  if(def.kind==='overrides'){
    overridesEditor=createEventOverridesEditor(value=>{
      settings=normalizeOptions({...settings,eventOverrides:value});
      presetSelect.value='custom-current';
      syncPresetActions();
      syncControls();
      persistCurrent();
      refresh(selectedView);
    });
    row.append(overridesEditor.element);
  }
  const commit = () => {
    const raw = control instanceof HTMLInputElement && control.type === 'checkbox'
      ? control.checked : control.value;
    settings = normalizeOptions({ ...settings, [def.key]: raw });
    presetSelect.value='custom-current';
    syncPresetActions();
    syncControls();
    persistCurrent();
    refresh(selectedView);
  };
  if(def.kind==='trigger-rules'){
    const target=def.key==='chatTriggerRules'?'chat':'wall';
    const rulesField=control as HTMLTextAreaElement;
    const actions=document.createElement('div');actions.className='trigger-rules-actions';
    const report=document.createElement('small');report.className='trigger-rules-report';
    const updateReport=()=>{
      const parsed=parseTriggerRules(rulesField.value,target);
      report.textContent=parsed.rules.length+' active rules'+(parsed.errors.length?' · '+parsed.errors.length+' invalid (ignored)':'');
      report.dataset.invalid=String(parsed.errors.length>0);
    };
    const load=document.createElement('button');load.type='button';load.textContent='Load examples';
    load.addEventListener('click',()=>{
      rulesField.value=starterTriggerRules(target);
      rulesField.dispatchEvent(new Event('change',{bubbles:true}));
      updateReport();
    });
    actions.append(load);
    for(const kind of ['command','event'] as const){
      const button=document.createElement('button');button.type='button';
      button.textContent=kind==='command'?'Test command':'Test channel event';
      button.addEventListener('click',()=>{
        const rule=parseTriggerRules(String(settings[def.key]),target).rules.find(rule=>rule.kind===kind);
        if(!rule){notify('Add or load a '+kind+' trigger rule first.');return;}
        if(!enabledPreviews[target]){notify('Enable the '+target+' preview to test its rules.');return;}
        previewFrames[target].contentWindow?.postMessage({type:'overlay-kit-trigger-preview',kind,key:rule.key},location.origin);
        notify('Synthetic '+kind+' sent only to the '+target+' preview.');
      });
      actions.append(button);
    }
    row.append(actions,report);
    rulesField.addEventListener('input',updateReport);
    rulesField.addEventListener('change',updateReport);
    ruleDiagnostics.set(def.key,updateReport);
    updateReport();
  }
  if(def.kind!=='font')control.addEventListener('change', commit);
  if (def.kind === 'range') control.addEventListener('input', () => {
    output.textContent = format(def, control.value);
    syncRangeVisual(control as HTMLInputElement);
  });
}
hydrateMingcuteIcons(groups);

function syncRangeVisual(control:HTMLInputElement):void {
  if(control.type!=='range')return;
  const min=Number(control.min||0);const max=Number(control.max||100);const value=Number(control.value);
  const progress=max>min?Math.max(0,Math.min(100,(value-min)/(max-min)*100)):0;
  control.style.setProperty('--range-progress',progress.toFixed(2)+'%');
}
function syncControls() {
  for (const def of OPTION_DEFINITIONS) {
    const control = controls.get(def.key)!;
    const value = settings[def.key];
    const cueRow=cueRows.get(def.key);
    if(cueRow)cueRow.dataset.cueEnabled=String(Boolean(value));
    if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(value);
    else if(def.kind==='font')fontPicker?.setValue(String(value));
    else control.value = String(value);
    if(control instanceof HTMLInputElement)syncRangeVisual(control);
    labels.get(def.key)!.textContent = def.kind==='font'
      ? (String(value)||'System') : format(def,value);
    ruleDiagnostics.get(def.key)?.();
  }
  // Reevaluate dependent option visibility immediately when the username
  // location changes, including after loading presets or imported links.
  filter();
}
function syncPresetActions() {
  loadPresetButton.disabled=presetSelect.value==='custom-current';
  deletePresetButton.disabled=!presetSelect.value.startsWith('custom:');
}
function rebuildPresets(selected = 'custom-current') {
  presetSelect.replaceChildren();
  const manual = document.createElement('option');
  manual.value = 'custom-current'; manual.textContent = 'Current edits';
  presetSelect.append(manual);
  for (const [name, value] of Object.entries(PRESETS)) {
    const entry = document.createElement('option');
    entry.value = 'built-in:' + name;
    entry.textContent = name[0]!.toUpperCase() + name.slice(1);
    entry.dataset.builtIn = 'true';
    presetSelect.append(entry);
    void value;
  }
  for (const name of [...custom[selectedView].keys()].sort()) {
    const entry = document.createElement('option');
    entry.value = 'custom:' + name;
    entry.textContent = name;
    presetSelect.append(entry);
  }
  presetSelect.value = selected;
  syncPresetActions();
}
const previewFrames:Record<OverlayEditorView,HTMLIFrameElement>={wall,chat,avatars,events};
function publishBrowserPreviewPacket(source:ViewerSource,packet:BrowserPreviewPacket,frame?:HTMLIFrameElement){
  if(!directBrowserLive||source.platform!=='youtube')return;
  for(const target of frame?[frame]:Object.values(previewFrames)){
    if(target.src!=='about:blank')target.contentWindow?.postMessage({type:'overlay-kit-preview-live-packet',source,packet},location.origin);
  }
}
const stopWatchingYouTubeKey=watchBrowserYouTubeKey(()=>{
  if(!directBrowserLive)return;
  for(const source of selectedHostedSources.filter(item=>item.platform==='youtube')){
    sendHostedSources(source);hostedSession?.reconnect(source);
  }
});
function sendHostedSources(reconnect?:ViewerSource,frame?:HTMLIFrameElement){
  if(!hostedLive)return;
  for(const target of frame?[frame]:Object.values(previewFrames)){
    if(target.src==='about:blank')continue;
    target.contentWindow?.postMessage({type:'overlay-kit-preview-sources',
      sources:selectedHostedSources,reconnect},location.origin);
    for(const source of selectedHostedSources){
      const current=sourceStatuses.get(sourceKey(source));
      if(current)publishBrowserPreviewPacket(source,{type:'status',value:current},target);
    }
  }
}

for(const frame of Object.values(previewFrames))frame.addEventListener('load',()=>{
  if(frame.src!=='about:blank'&&frame.contentDocument?.URL===frame.src){frame.dataset.previewReady='true';sendHostedSources(undefined,frame);}
});
function refresh(only?: OverlayEditorView,forceReload=false) {
  const make = (path: string, view: OverlayEditorView, preview: boolean) => {
    const parts = new URLSearchParams(writeOptions(current[view], view));
    if (preview) parts.set('preview', '1');
    if(!liveCapabilityKnown)parts.set('live','0');
    const search=parts.toString();
    const url=path+(search?'?'+search:'');
    return hostedLive ? withViewerSources(url,selectedHostedSources) : url;
  };
  linkWall.href = make('wall.html', 'wall', false);
  linkChat.href = make('chat.html', 'chat', false);
  linkAvatars.href = make('avatars.html', 'avatars', false);
  linkEvents.href = make('events.html', 'events', false);
  for(const view of TAB_VIEWS){
    const frame=previewFrames[view];
    if(!enabledPreviews[view]){suspendPreviewFrame(frame);continue;}
    if(!only||only===view)updatePreviewFrame(frame,make(view+'.html',view,true),current[view],location.origin,forceReload);
  }
}
function filter() {
  const term = search.value.toLowerCase().trim();
  const visible = new Set(optionsForEditor(selectedView, true, term).map(def => def.key));
  for (const section of sections.values()) {
    let any = false;
    for (const row of Array.from(section.querySelectorAll<HTMLElement>('.option-row'))) {
      const key=row.dataset.optionKey as keyof OverlayOptions;
      const matched = visible.has(key) && isOptionApplicable(key,settings);
      row.hidden = !matched;
      if (matched) any = true;
    }
    section.hidden = !any;
    if (any && term) section.open = true;
  }
}
function setMobilePanel(mode: 'preview' | 'settings') {
  studio.dataset.mobilePanel = mode;
}
showSettings.addEventListener('click', () => setMobilePanel('settings'));
showPreview.addEventListener('click', () => setMobilePanel('preview'));

function syncPreviewAvailability(){
  let count=0;
  for(const view of TAB_VIEWS){
    const enabled=enabledPreviews[view],card=previewCards[view];
    if(enabled)count++;
    editorButtons[view].dataset.enabled=String(enabled);
    if(card){
      card.dataset.enabled=String(enabled);
      card.querySelector<HTMLElement>('.preview-disabled')!.hidden=enabled;
    }
    previewFrames[view].hidden=!enabled;
  }
  previewGrid.style.setProperty('--enabled-preview-count',String(Math.max(1,count)));
  input('preview-empty').hidden=!comparing||count>0;
  for(const id of ['send-sample','send-burst'])input<HTMLButtonElement>(id).disabled=!enabledPreviews[selectedView];
}
function setEditor(view: OverlayEditorView) {
  current[selectedView] = settings;
  selectedView = view;
  settings = current[view];
  syncControls();
  rebuildPresets();
  // Top workspace tabs always navigate back to the canvas on narrow screens.
  setMobilePanel('preview');
  for (const key of TAB_VIEWS) {
    const chosen = key === view;
    editorButtons[key].setAttribute('aria-selected', String(chosen));
    editorButtons[key].tabIndex = chosen ? 0 : -1;
    const card = previewCards[key];
    if (card) {
      card.dataset.active = String(chosen);
      card.style.order = chosen ? '0' : '1';
    }
  }
  input<HTMLButtonElement>('send-sample').textContent = view==='events' ? 'Send test notification ↗' : 'Send emote + message ↗';
  input<HTMLButtonElement>('send-burst').textContent = view==='events' ? 'Queue 5 test alerts' : 'Send sample burst';
  workspace.setAttribute('aria-labelledby', editorButtons[view].id);
  previewGrid.dataset.focus = view;
  syncPreviewAvailability();
  input('presets-title').textContent=viewNames[view]+' presets';
  resetConfirmation.hidden=true;
  try { localStorage.setItem(EDITOR_VIEW_KEY, view); } catch { /* optional persistence */ }
  filter();
}
function toggleComparison() {
  comparing = !comparing;
  setMobilePanel('preview');
  previewGrid.dataset.compare = String(comparing);
  syncPreviewAvailability();
  compareButton.setAttribute('aria-pressed', String(comparing));
  compareButton.title = comparing ? 'Show focused preview' : 'Compare overlay previews';
}
function presetRecords() {
  return {
    wall:Object.fromEntries(custom.wall),
    chat:Object.fromEntries(custom.chat),
    avatars:Object.fromEntries(custom.avatars),
    events:Object.fromEntries(custom.events),
  };
}
function savePresets() {
  saveObject(FILE_KEY, {version:OPTIONS_VERSION,format:'per-overlay',presets:presetRecords()});
}
input<HTMLButtonElement>('confirm-reset').addEventListener('click', () => {
  if(resetConfirmation.hidden)return;
  resetConfirmation.hidden=true;resetButton.focus();
  // Reset only the selected overlay, leaving the other untouched.
  settings = normalizeOptions(DEFAULT_OPTIONS);
  rebuildPresets();
  syncControls();
  persistCurrent();
  refresh(selectedView);
  notify('Restored ' + (selectedView === 'wall' ? 'Emote Wall' : selectedView === 'avatars' ? 'Avatars' : selectedView === 'events' ? 'Events' : 'Chat') + ' defaults. Named presets were kept.');
});
presetSelect.addEventListener('change',syncPresetActions);
loadPresetButton.addEventListener('click', () => {
  const selected = presetSelect.value;
  if (selected.startsWith('built-in:')) {
    const preset = PRESETS[selected.slice(9) as keyof typeof PRESETS];
    if (preset) settings = normalizeOptions(preset);
  } else if (selected.startsWith('custom:')) {
    const preset = custom[selectedView].get(selected.slice(7));
    if (preset) settings = normalizeOptions(preset);
  } else return;
  syncControls();
  persistCurrent();
  refresh(selectedView);
  notify('Loaded preset into the selected overlay.');
});
input<HTMLButtonElement>('save-preset').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name || name.length > 40 || Object.hasOwn(PRESETS, name)) {
    notify('Enter a unique preset name (up to 40 characters).'); return;
  }
  custom[selectedView].set(name, normalizeOptions(settings));
  savePresets();
  rebuildPresets('custom:' + name);
  notify('Saved local preset: ' + name);
});
deletePresetButton.addEventListener('click', () => {
  if (!presetSelect.value.startsWith('custom:')) return notify('Choose a saved custom preset to delete.');
  const name = presetSelect.value.slice(7);
  custom[selectedView].delete(name);
  savePresets();
  rebuildPresets();
  notify('Deleted local preset: ' + name);
});
exportAllButton.addEventListener('click', () => {
  current[selectedView]=settings;
  const backup=createEditorBackup(current,presetRecords(),selectedView);
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download='overlay-kit-user-settings.json';
  link.click();
  URL.revokeObjectURL(url);
  notify('Exported all overlay settings and user presets.');
});
importAllButton.addEventListener('click',()=>importAllFile.click());
importAllFile.addEventListener('change',async event=>{
  const file=(event.target as HTMLInputElement).files?.[0];
  if(!file)return;
  try{
    if(file.size>524288)throw Error('User settings backup is too large.');
    const backup=parseEditorBackup(JSON.parse(await file.text()) as unknown);
    for(const view of TAB_VIEWS){
      current[view]=backup.settings[view];
      custom[view].clear();
      for(const [name,preset] of Object.entries(backup.presets[view]))custom[view].set(name,preset);
    }
    selectedView=backup.activeView;
    settings=current[selectedView];
    savePresets();
    persistCurrent();
    setEditor(selectedView);
    refresh();
    notify('Imported all overlay settings and user presets from '+file.name+'.');
  }catch(error){
    notify(error instanceof Error?error.message:'Could not import user settings.');
  }finally{
    importAllFile.value='';
  }
});
editorButtons.wall.addEventListener('click', () => setEditor('wall'));
editorButtons.chat.addEventListener('click', () => setEditor('chat'));
editorButtons.avatars.addEventListener('click', () => setEditor('avatars'));
editorButtons.events.addEventListener('click', () => setEditor('events'));
// A real tablist: arrow keys move focus and activate the matching workspace.
const VIEW_ORDER = TAB_VIEWS;
for (const [index, view] of VIEW_ORDER.entries()) {
  editorButtons[view].addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = VIEW_ORDER[(index + offset + VIEW_ORDER.length) % VIEW_ORDER.length]!;
    setEditor(next);
    editorButtons[next].focus();
  });
}
compareButton.addEventListener('click', toggleComparison);
search.addEventListener('input', filter);

let sequence = 200;
const bridge = createOverlayBridge('myrqyry-overlay-kit-v1', () => {});
input<HTMLButtonElement>('send-sample').addEventListener('click', () => {
  if(selectedView==='events'){
    events.contentWindow?.postMessage({type:'overlay-kit-event-preview',signal:sampleSocialSignal(sequence++)},location.origin);
    notify('Synthetic Event preview sent to the Events pane only.');
    return;
  }
  bridge.publish(sampleMessage(sequence++,sampleAssets.profiles()));
  notify('Sample event sent to open same-origin overlay pages.');
});
input<HTMLButtonElement>('send-burst').addEventListener('click', () => {
  if(selectedView==='events'){
    for(let i=0;i<5;i++)events.contentWindow?.postMessage({type:'overlay-kit-event-preview',signal:sampleSocialSignal(sequence++)},location.origin);
    notify('5 synthetic Events queued in the Events preview only.');
    return;
  }
  const profiles=sampleAssets.profiles();
  for (let i = 0; i < 12; i++) bridge.publish(sampleMessage(sequence++,profiles));
  notify('12 synthetic events sent. The active-item budget applies.');
});
window.addEventListener('pagehide', () => {
  for(const timer of copyTimers.values())clearTimeout(timer);copyTimers.clear();
  stopWatchingYouTubeKey();tabActions.dispose();bridge.dispose(); hostedSession?.dispose();sourceChips.dispose();accountPanel.dispose(); liveFeed?.dispose(); fontPicker?.dispose(); platformPicker.dispose();
}, { once:true });
rebuildPresets();
syncControls();
setEditor(selectedView);
refresh();
