import {createRepeatDetector,type RepeatMatch,type RepeatSenderScope,type RepeatObservation} from '@myrqyry/chatbus';
import {createChatEdgeTreatment,type ChatEdgeFadeSettings} from './chat-edge-fade';
import type { DisplayMessage, EmoteArtwork,DisplayBadge,DisplayNamePaint } from './chatbus';
import { createChatMessageElement, createEmoteArtwork, extractEmotes, setChatBadgeImages, setChatMessageBackground, setChatMessageTextColor, setChatNamePaint, safeColor, updateChatMentionColors, observeFloatingNameplateNotch, stopFloatingNameplateNotch, syncFloatingNameplateNotch, type ChatAppearance } from './renderers';
import { emojiImageUrl, splitEmojiText, type WallEmojiService } from './emoji-service';
import { createScene, type OverflowPolicy } from './scene';
import { startChatExit } from './chat-motion';
import { startLetterScramble, startLetterTypewriter } from './letter-motion';
import { captureDeletionFrame, chooseDeletionVisual, mountDeletionGhost, type ChatDeletionEffect } from './chat-deletion';
import { startWallExit, type WallEntrance, type WallExit } from './wall-motion';
import { createConstellationField } from './wall-constellation';
import { createWallCollisions } from './wall-collisions';
import { mountEchoPrint } from './wall-echo';
import { canFragmentArtwork, isCinematicEntrance, isCinematicExit, mountCinematicEntrance } from './wall-cinematics';
import { createChatReflow } from './chat-reflow';
import { applyChatStylePack } from './style-packs';
import { applyWallStylePack } from './wall-style-packs';
import { applyWallAesthetics,normalizeWallColor,normalizeWallFinish,type WallColor,type WallFinish } from './wall-aesthetics';

export interface ViewSettings {
  maxActive?: number;
  ttlMs?: number;
  overflow?: OverflowPolicy;
}
export interface MountedView {
  element: HTMLElement;
  /** Called on eviction, expiration and scene disposal. Kill GSAP/physics here. */
  dispose?: () => void;
  /** Optional custom exit; natural expiry and opt-in capacity retirement use it.
   * Moderation and explicit removal remain immediate. */
  exit?: (done: () => void) => void | (() => void);
}
export interface ChatFeedSettings extends ViewSettings, ChatAppearance, ChatEdgeFadeSettings {
  align?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'bottom';
  layout?: 'stack' | 'strip' | 'spotlight';
  stripRows?: 'single' | 'double';
  repeatMode?: 'off' | 'count' | 'refresh' | 'bump';
  repeatMatch?: RepeatMatch;
  repeatScope?: RepeatSenderScope;
  repeatWindowMs?: number;
  repeatShowCount?: boolean;
  stylePack?: string;
  spacing?: number;
  padding?: number;
  /** Max chat card width in CSS pixels. Zero preserves the layout default. */
  maxMessageWidth?: number;
  /** Fill a positive width cap instead of shrink-wrapping short messages. */
  uniformMessageWidth?: boolean;
  renderMessage?: (message: DisplayMessage, appearance: ChatAppearance) => MountedView;
  smoothReflow?: boolean;
  reflowMs?: number;
  deleteEffect?: ChatDeletionEffect;
  deleteMs?: number;
}
const matchingUser = (
  user: { id?: string; username?: string },
  target: { userId?: string; username?: string },
): boolean => Boolean(
  (target.userId && user.id && target.userId === user.id)
  || (target.username && user.username &&
    target.username.toLowerCase() === user.username.toLowerCase())
);
const matchingSource=(sourceId:string|undefined,targetSourceId:string|undefined):boolean=>
  !targetSourceId || sourceId===targetSourceId;
export type WallMotion = 'still' | 'float' | 'bounce' | 'burst' | 'orbit' | 'sway' | 'flutter' | 'collide';
export interface EmoteWallSettings extends ViewSettings {
  emojiService?: WallEmojiService;
  /** Opt-in, bounded Twitch GIPHY subscriber media on the emote wall. */
  wallGifs?:boolean;
  size?: number;
  motion?: WallMotion;
  wallEnter?: WallEntrance;
  wallExit?: WallExit;
  wallEnterMs?: number;
  wallExitMs?: number;
  wallField?: 'none' | 'constellation';
  wallStyle?: string;
  wallColor?: WallColor;
  wallFinish?: WallFinish;
  wallSpeed?: number;
  wallDistance?: number;
  spawn?: 'full' | 'top' | 'bottom' | 'edges';
  renderArtwork?: (art: EmoteArtwork, size: number) => MountedView;
}
function hash(input: string): number {
  let value = 2166136261;
  for (const code of input) value = Math.imul(value ^ code.charCodeAt(0), 16777619);
  return value >>> 0;
}
const clamp = (v: number, min: number, max: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** A bounded, transport-neutral chat feed. */
export function createChatFeed(root: HTMLElement, settings: ChatFeedSettings = {}) {
  let appearance: ChatAppearance = {
    ...settings,
    newLineAfterUsername:settings.newLineAfterUsername ?? settings.stripRows!=='single',
  };
  let renderMessage = settings.renderMessage;
  let deleteEffect: ChatDeletionEffect = settings.deleteEffect ?? 'mixed';
  let deleteMs = clamp(settings.deleteMs ?? 350, 120, 700, 350);
  const afterimages = new Map<string, { user: DisplayMessage['user']; sourceId?:string; cancel: () => void }>();

  // Bounded per-feed identity colors. A Kick name must never inherit its
  // namesake's Twitch color, nor a different broadcaster's chat color.
  // Only actual normalized author colors enter the cache; no profile fetch,
  // guessed palette, global state, or new server contract.
  const MAX_COLOR_SCOPES=24;
  const MAX_COLOR_KEYS_PER_SCOPE=1024;
  const knownColors=new Map<string,Map<string,string>>();
  // Associate validated user IDs with their login/display aliases so a
  // moderation clear by ID also removes an earlier observed @login color.
  const aliasesById=new Map<string,Map<string,readonly string[]>>();
  const waitingMentions=new Map<string,Set<string>>();
  const watchedByRow=new Map<string,readonly string[]>();
  const scoped=(message:DisplayMessage):string=>
    (message.sourceId || (message.platform??'local')+':'+(message.channelName??'default'))
      .toLocaleLowerCase('en-US').slice(0,200);
  const keyName=(value:string|undefined):string|undefined=>{
    const name=value?.normalize('NFC').toLocaleLowerCase('en-US').trim();
    return name && name.length<=64 ? 'u:'+name : undefined;
  };
  const keyId=(value:string|undefined):string|undefined=>
    value && value.length<=128 ? 'id:'+value : undefined;
  const watchedKey=(scope:string,key:string):string=>JSON.stringify([scope,key]);
  const identityKey=(identity:{username?:string;userId?:string;text:string})=>
    keyId(identity.userId)??keyName(identity.username??identity.text.replace(/^@/u,''));
  const resolveMention=(message:DisplayMessage,identity:{username?:string;userId?:string;text:string})=>
    knownColors.get(scoped(message))?.get(identityKey(identity)??'');
  const unregisterMentions=(id:string):void=>{
    for(const key of watchedByRow.get(id)??[]){
      const waiting=waitingMentions.get(key);
      waiting?.delete(id);
      if(waiting?.size===0)waitingMentions.delete(key);
    }
    watchedByRow.delete(id);
  };
  const watchMentions=(message:DisplayMessage,element:HTMLElement):void=>{
    const scope=scoped(message);
    const keys=new Set<string>();
    for(const mention of Array.from(element.querySelectorAll<HTMLElement>('[data-mention="true"]'))){
      const key=identityKey({
        text:mention.textContent??'',username:mention.dataset.mentionUsername,
        userId:mention.dataset.mentionUserId,
      });
      if(key)keys.add(watchedKey(scope,key));
    }
    if(!keys.size)return;
    watchedByRow.set(message.id,[...keys]);
    for(const key of keys){
      let ids=waitingMentions.get(key);
      if(!ids){ids=new Set();waitingMentions.set(key,ids);}
      ids.add(message.id);
    }
  };
  const recolorRows=(keys:readonly string[],scene:ReturnType<typeof createScene<DisplayMessage>>):void=>{
    const ids=new Set<string>();
    for(const key of keys)for(const id of waitingMentions.get(key)??[])ids.add(id);
    for(const id of ids)scene.patch(id,(message,element)=>
      updateChatMentionColors(element,identity=>resolveMention(message,identity)));
  };
  const observeAuthor=(message:DisplayMessage,scene:ReturnType<typeof createScene<DisplayMessage>>):void=>{
    const color=safeColor(message.user.color);
    if(!color)return;
    const scope=scoped(message);
    let colors=knownColors.get(scope);
    if(!colors){
      colors=new Map();
      knownColors.set(scope,colors);
      if(knownColors.size>MAX_COLOR_SCOPES){
        const oldest=knownColors.keys().next().value!;
        knownColors.delete(oldest);
        aliasesById.delete(oldest);
      }
    }
    const changed:string[]=[];
    const login=keyName(message.user.username);
    const display=keyName(message.user.name);
    const id=keyId(message.user.id);
    if(id){
      let aliases=aliasesById.get(scope);
      if(!aliases){aliases=new Map();aliasesById.set(scope,aliases);}
      aliases.delete(id);
      aliases.set(id,[...new Set([login,display].filter((v):v is string=>!!v))]);
      if(aliases.size>MAX_COLOR_KEYS_PER_SCOPE/2)
        aliases.delete(aliases.keys().next().value!);
    }
    const entries=new Set([login,display,id]);
    for(const key of entries){
      if(!key)continue;
      const previous=colors.get(key);
      colors.delete(key);colors.set(key,color);
      if(previous!==color)changed.push(watchedKey(scope,key));
      if(colors.size>MAX_COLOR_KEYS_PER_SCOPE)colors.delete(colors.keys().next().value!);
    }
    if(changed.length)recolorRows(changed,scene);
  };
  const forgetAuthor=(target:{sourceId?:string;userId?:string;username?:string},scene:ReturnType<typeof createScene<DisplayMessage>>):void=>{
    const id=keyId(target.userId);
    const name=keyName(target.username);
    if(!id&&!name)return;
    const scopes=target.sourceId?[target.sourceId.toLocaleLowerCase('en-US').slice(0,200)]:[...knownColors.keys()];
    const changed:string[]=[];
    for(const scope of scopes){
      const colors=knownColors.get(scope);
      if(!colors)continue;
      const aliases=aliasesById.get(scope);
      const keys=new Set([id,name].filter((v):v is string=>!!v));
      if(id)for(const alias of aliases?.get(id)??[])keys.add(alias);
      if(name){
        for(const [knownId,logins] of aliases??[]){
          if(logins.includes(name)){
            keys.add(knownId);
            for(const alias of logins)keys.add(alias);
          }
        }
      }
      for(const key of keys){
        if(colors.delete(key))changed.push(watchedKey(scope,key));
        if(key.startsWith('id:'))aliases?.delete(key);
      }
      if(!colors.size)knownColors.delete(scope);
      if(!aliases?.size)aliasesById.delete(scope);
    }
    if(changed.length)recolorRows(changed,scene);
  };

  const activeScrambles = new Set<() => void>();
  const activeTypewriters = new Set<() => void>();
  const beginTypewriter = (element: HTMLElement, durationMs: number): (() => void) => {
    let release!: () => void;
    const stop = startLetterTypewriter(element, durationMs, () => activeTypewriters.delete(release));
    release = () => { stop(); activeTypewriters.delete(release); };
    if (element.querySelector('.overlay-typewriter-caret')) activeTypewriters.add(release);
    return release;
  };
  const MAX_SCRAMBLE_ROWS = 8;
  const beginScramble = (element: HTMLElement, durationMs: number): (() => void) => {
    // A long-message fallback or reduced-motion row must not cancel someone
    // else's still-active scramble just because it was delivered next.
    if (!element.querySelector('.overlay-letter[data-scramble-ready]') ||
      (element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)) {
      return () => undefined;
    }
    while (activeScrambles.size >= MAX_SCRAMBLE_ROWS) {
      const oldest = activeScrambles.values().next().value;
      if (!oldest) break;
      oldest();
    }
    let release!: () => void;
    const stop = startLetterScramble(element, durationMs, () => activeScrambles.delete(release));
    release = () => {
      stop();
      activeScrambles.delete(release);
    };
    // Non-scrambling rows don't need cleanup. A bounded set is fine because
    // the decorator yields at most 120 characters per row.
    if (element.querySelector('.overlay-letter[data-scrambling]')) activeScrambles.add(release);
    return release;
  };

  const cancelGhost = (id: string) => {
    const ghost = afterimages.get(id);
    if (!ghost) return;
    afterimages.delete(id);
    ghost.cancel();
  };
  const cancelAfterimages = () => {
    for (const ghost of afterimages.values()) ghost.cancel();
    afterimages.clear();
  };

  const applyLayout = (state: ChatFeedSettings) => {
    const layout = state.layout ?? 'stack';
    root.dataset.chatLayout = layout;
    const newLine=state.nameplateStyle==='floating' ||
      (state.newLineAfterUsername ?? state.stripRows!=='single');
    root.dataset.stripRows = newLine?'double':'single';
    root.style.display = 'flex';
    // Scene admission remains chronological in the DOM. Reversing only the
    // flex flow makes a top-anchored stack receive the newest row at its top,
    // while a bottom-anchored stack naturally grows upward from its bottom.
    root.style.flexDirection = layout === 'strip' ? 'row'
      : state.vertical === 'top' ? 'column-reverse' : 'column';
    root.style.flexWrap = 'nowrap';
    root.style.overflow = 'hidden';
    // In horizontal strip mode, the newest message must remain in view on
    // the right, even when cumulative row widths exceed the OBS source.
    root.style.justifyContent = 'flex-end';
    root.style.alignItems = layout === 'strip' ? 'flex-end'
      : state.align === 'center' ? 'center'
      : state.align === 'right' ? 'flex-end' : 'flex-start';
    root.style.gap = clamp(state.spacing ?? 8, 0, 40, 8) + 'px';
    const widthCap=clamp(state.maxMessageWidth ?? 0,0,1920,0);
    root.style.setProperty('--chat-message-max-width',widthCap>0?widthCap+'px':'100%');
    root.dataset.messageWidthLimited=String(widthCap>0);
    root.dataset.uniformMessageWidth=String(widthCap>0 && state.uniformMessageWidth===true);
    const padding = clamp(state.padding ?? 18, 0, 90, 18);
    root.style.padding = padding + 'px';
    // OBS sources are viewport-sized. Reserve the canvas padding, bubble
    // padding and the always-present identity header before allocating
    // height to an oversized emote. Small sources must retain legible text.
    if (layout === 'strip') {
      const header = newLine ? Math.ceil(clamp(state.fontSize ?? 20, 8, 90, 20)
        * clamp(state.lineHeight ?? 1.45, 1, 2.5, 1.45)) + 4 : 0;
      root.style.setProperty('--chat-emote-height-limit',
        `max(12px, calc(100dvh - ${2 * padding + 12 + header}px))`);
    } else root.style.removeProperty('--chat-emote-height-limit');
    root.style.boxSizing = 'border-box';
    const supportsPattern=typeof CSS==='undefined'||typeof CSS.supports!=='function'||CSS.supports('mask-composite','intersect');
    const mask=createChatEdgeTreatment(state,supportsPattern);
    root.dataset.exitEdge=mask.edge;
    root.style.maskImage=mask.image;
    root.style.webkitMaskImage=mask.image;
    root.style.maskSize=mask.size;
    root.style.maskRepeat=mask.repeat;
    root.style.maskPosition=mask.position;
    root.style.maskComposite=mask.composite;
  };
  const validateCapacity=(value:number)=>{
    if(!Number.isSafeInteger(value)||value<1||value>10000)
      throw new RangeError('maxActive must be an integer from 1 to 10000');
  };
  if(settings.maxActive!==undefined)validateCapacity(settings.maxActive);
  let layoutSettings: ChatFeedSettings = { ...settings };
  const makeRepeats=()=>createRepeatDetector({match:layoutSettings.repeatMatch,
    senderScope:layoutSettings.repeatScope,windowMs:clamp(layoutSettings.repeatWindowMs??15000,1000,120000,15000)});
  let repeats=makeRepeats();
  const grouped=new Map<string,{observation:RepeatObservation;members:Map<string,Pick<DisplayMessage['user'],'id'|'username'>>;scope:string}>();
  const aliases=new Map<string,string>();
  const releaseGroup=(id:string)=>{
    const group=grouped.get(id);
    if(!group)return;
    for(const member of group.members.keys())aliases.delete(member);
    grouped.delete(id);
    repeats.forget(group.scope,id);
  };
  const paintRepeat=(id:string,element:HTMLElement)=>{
    const group=grouped.get(id);
    let badge=element.querySelector<HTMLElement>('.overlay-repeat-count');
    if(!group||layoutSettings.repeatShowCount===false){badge?.remove();delete element.dataset.repeatBadge;return;}
    if(!badge){
      badge=document.createElement('span');
      badge.className='overlay-repeat-count';
      element.prepend(badge);
    }
    element.dataset.repeatBadge='true';
    const {count,uniqueSenderCount}=group.observation;
    badge.textContent='×'+count+(uniqueSenderCount>1?' · '+uniqueSenderCount+' chatters':'');
    badge.setAttribute('aria-label',count+' repeated messages from '+uniqueSenderCount+' chatters');
  };
  const repeatInput=(message:DisplayMessage)=>{
    // Do not collapse replies, reward/paid messages, or special message traits.
    if(message.reply||message.traits?.highlighted||message.traits?.firstMessage||message.traits?.customRewardId||
       message.parts.some(part=>part.type==='emote'&&part.bits!==undefined))return;
    const text=message.parts.map(part=>part.type==='emote'?part.emote.code:part.text).join('');
    const variant=message.parts.some(part=>part.type!=='text')?JSON.stringify(message.parts.map(part=>{
      if(part.type==='emote')return ['emote',part.emote.provider,part.emote.id,part.emote.code,part.emote.overlays,part.emote.modifiers];
      if(part.type==='media')return ['media',part.mediaType,part.url,part.text];
      if(part.type==='mention')return ['mention',part.userId,part.username,part.text];
      return ['text',part.text];
    })):'';
    const sender=message.user.id?'id:'+message.user.id:message.user.username?'login:'+message.user.username.toLowerCase():'';
    if(!sender||!text.trim())return;
    return {id:message.id,scope:message.sourceId??JSON.stringify([message.platform??'local',message.channelName??'default']),sender,text,variant};
  };

  let desiredMaxActive = settings.maxActive ?? 80;
  let appliedStyle = applyChatStylePack(root,settings.stylePack ?? 'plain');
  const sceneCapacity = () => layoutSettings.layout === 'spotlight' ? 1 : desiredMaxActive;
  applyLayout(layoutSettings);
  const reflow = createChatReflow(root, {
    enabled: settings.smoothReflow ?? false,
    durationMs: settings.reflowMs ?? 240,
  });
  let pruneFrame: number | undefined;
  let disposed=false;
  const pruneClippedMessages = () => {
    if (disposed || layoutSettings.layout !== 'strip') return;
    const bounds=root.getBoundingClientRect();
    if (!(bounds.width>0)) return;
    const rows=Array.from(root.children).filter((node):node is HTMLElement=>
      node instanceof HTMLElement && node.classList.contains('overlay-chat-message'));
    // Never discard the newest item even when it is wider than the source.
    for(const row of rows.slice(0,-1)){
      if (row.getBoundingClientRect().right <= bounds.left+0.5) {
        const id=row.dataset.messageId;
        if (id) scene.remove(id); // Releases scene timers and renderer resources.
      }
    }
  };
  const schedulePrune = () => {
    if (disposed || layoutSettings.layout !== 'strip' || pruneFrame !== undefined
        || typeof requestAnimationFrame !== 'function') return;
    pruneFrame = requestAnimationFrame(()=>{
      pruneFrame=undefined;
      pruneClippedMessages();
    });
  };
  const resizeObserver=typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(schedulePrune) : null;
  resizeObserver?.observe(root);
  const scene = createScene<DisplayMessage>({
    beforeDomChange: reflow.beforeChange,
    afterDomChange: () => { reflow.afterChange(); schedulePrune(); },
    root,
    maxActive: sceneCapacity(),
    ...(settings.ttlMs !== undefined ? { ttlMs: settings.ttlMs } : {}),
    ...(settings.overflow !== undefined ? { overflow: settings.overflow } : {}),
    render: msg => {
      const current = {...appearance,resolveMentionColor:(identity:{username?:string;userId?:string;text:string})=>
        resolveMention(msg,identity)};
      if (renderMessage) {
        const mounted=renderMessage(msg,current);
        return {...mounted,dispose:()=>{releaseGroup(msg.id);mounted.dispose?.();}};
      }
      const element = createChatMessageElement(msg, current);
      watchMentions(msg,element);
      observeFloatingNameplateNotch(element);
      const stopScramble = (current.letterEnter === 'scramble' || current.letterEnter === 'split-flap')
        ? beginScramble(element, current.letterEnterMs ?? current.enterMs ?? 320)
        : () => undefined;
      const stopTypewriter = current.letterEnter === 'typewriter'
        ? beginTypewriter(element, current.letterEnterMs ?? current.enterMs ?? 320)
        : () => undefined;
      return {
        element,
        dispose: () => {releaseGroup(msg.id);stopScramble();stopTypewriter();stopFloatingNameplateNotch(element);unregisterMentions(msg.id);},
        exit: (done: () => void) => {
          stopScramble(); // Restore the real text before natural letter exit.
          stopTypewriter();
          return startChatExit(element, current.exit ?? 'fade', current.exitMs ?? 260, done);
        },
      };
    },
  });
  const removeModeratedMessage = (id: string): boolean => {
    let frame: ReturnType<typeof captureDeletionFrame> = null;
    let element: HTMLElement | null = null;
    const active = scene.snapshot().find(item => item.id === id);
    const animate = deleteEffect !== 'none' && root.isConnected &&
      !(typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (active && animate) scene.patch(id, (_value, mounted) => {
      element = mounted;
      frame = captureDeletionFrame(mounted);
    });
    cancelGhost(id);
    if (frame && element && active && animate) {
      while (afterimages.size >= 8) {
        const oldest = afterimages.keys().next().value;
        if (oldest === undefined) break;
        cancelGhost(oldest);
      }
      // The replacement immediately detaches original chat DOM. The new
      // in-flow visual only contains our label and strokes.
      const cancel = mountDeletionGhost(element, frame,
        chooseDeletionVisual(id, deleteEffect), deleteMs,
        () => { afterimages.delete(id); });
      afterimages.set(id, { user: active.value.user, sourceId:active.value.sourceId, cancel });
    }
    // Removing logical chat also cancels its scene timers / asset ownership.
    return scene.remove(id);
  };
  return {
    receive(message:DisplayMessage){
      if(disposed||scene.has(message.id)||aliases.has(message.id))return false;
      if((layoutSettings.repeatMode??'off')!=='off'){
        const input=repeatInput(message);
        if(input){
          const observation=repeats.observe(input,id=>scene.has(id));
          if(!observation)return false;
          if(observation.count>1){
            const id=observation.firstId;
            let group=grouped.get(id);
            if(!group){
              let first:DisplayMessage|undefined;
              scene.patch(id,value=>{first=value;});
              if(first){
                const representative:DisplayMessage=first;
                group={scope:input.scope,observation,members:new Map([[id,{id:representative.user.id,username:representative.user.username}]])};
                grouped.set(id,group);
              }
            }
            if(group){
              group.observation=observation;
              group.members.set(message.id,{id:message.user.id,username:message.user.username});
              aliases.set(message.id,id);
              scene.patch(id,(_value,element)=>paintRepeat(id,element));
              scene.touch(id,{refresh:layoutSettings.repeatMode!=='count',bump:layoutSettings.repeatMode==='bump'});
              observeAuthor(message,scene);
              return true;
            }
          }
          const accepted=scene.emit({id:message.id,value:message});
          if(accepted)observeAuthor(message,scene);
          else repeats.forget(input.scope,observation.firstId);
          return accepted;
        }
      }
      const accepted=scene.emit({id:message.id,value:message});
      if(accepted)observeAuthor(message,scene);
      return accepted;
    },
    configure(patch: ChatFeedSettings) {
      if(patch.maxActive!==undefined)validateCapacity(patch.maxActive);
      if(patch.stylePack!==undefined && patch.stylePack!==root.dataset.chatStyle){
        appliedStyle.dispose();
        appliedStyle = applyChatStylePack(root,patch.stylePack);
      }
      appearance = { ...appearance, ...patch };
      const resetRepeats=(['repeatMode','repeatMatch','repeatScope','repeatWindowMs'] as const).some(key=>
        patch[key]!==undefined&&patch[key]!==layoutSettings[key]);
      layoutSettings = { ...layoutSettings, ...patch };
      if(resetRepeats)repeats=makeRepeats();
      if(patch.repeatShowCount!==undefined)for(const id of grouped.keys())
        scene.patch(id,(_value,element)=>paintRepeat(id,element));
      // Keep older callers using configure({stripRows:'single'}) functional.
      if(patch.stripRows!==undefined && patch.newLineAfterUsername===undefined){
        appearance.newLineAfterUsername=patch.stripRows!=='single';
        layoutSettings.newLineAfterUsername=patch.stripRows!=='single';
      }
      if (patch.maxActive !== undefined) desiredMaxActive = patch.maxActive;
      applyLayout(layoutSettings);
      schedulePrune();
      if (patch.renderMessage !== undefined) renderMessage = patch.renderMessage;
      if (patch.deleteEffect !== undefined) deleteEffect = patch.deleteEffect;
      if (patch.deleteMs !== undefined) deleteMs = clamp(patch.deleteMs, 120, 700, 350);
      if (deleteEffect === 'none') cancelAfterimages();
      reflow.configure({
        ...(patch.smoothReflow !== undefined ? { enabled: patch.smoothReflow } : {}),
        ...(patch.reflowMs !== undefined ? { durationMs: patch.reflowMs } : {}),
      });
      scene.configure({ ...patch, maxActive:sceneCapacity() });
    },
    refreshAppearance() {
      // Existing rows keep their scene item, lifetime and exit ownership. Rebuild
      // only their presentation, suppressing entrance animation for content that
      // is already on screen.
      for (const stop of [...activeScrambles]) stop();
      for (const stop of [...activeTypewriters]) stop();
      for (const item of scene.snapshot()) scene.patch(item.id,(message,element)=>{
        const next=createChatMessageElement(message,{...appearance,enter:'none',letterEnter:'none',
          resolveMentionColor:identity=>resolveMention(message,identity)});
        stopFloatingNameplateNotch(element);
        element.className=next.className;
        element.style.cssText=next.style.cssText;
        for(const attribute of Array.from(element.attributes)){
          if(attribute.name.startsWith('data-') && attribute.name!=='data-message-id')element.removeAttribute(attribute.name);
        }
        for(const attribute of Array.from(next.attributes)){
          if(attribute.name.startsWith('data-') && attribute.name!=='data-message-id')element.setAttribute(attribute.name,attribute.value);
        }
        element.dataset.messageId=message.id;
        element.replaceChildren(...Array.from(next.childNodes));
        paintRepeat(message.id,element);
        observeFloatingNameplateNotch(element);
      });
    },
    snapshot: scene.snapshot,
    remove: (id:string)=>scene.remove(aliases.get(id)??id),
    removeMessage(id: string) { return removeModeratedMessage(aliases.get(id)??id); },
    updateBadges(id:string,badges:readonly DisplayBadge[]) {
      return scene.patch(id,(message,element)=>{
        message.user.badges=[...badges];
        setChatBadgeImages(element,badges,appearance,message.user.color);
        syncFloatingNameplateNotch(element);
      });
    },
    updateIdentity(id:string,identity:{badges:readonly DisplayBadge[];namePaint?:DisplayNamePaint}) {
      return scene.patch(id,(message,element)=>{
        message.user.badges=[...identity.badges];
        setChatBadgeImages(element,identity.badges,appearance,message.user.color);
        syncFloatingNameplateNotch(element);
        if(identity.namePaint) {
          message.user.namePaint=identity.namePaint;
          setChatNamePaint(element,identity.namePaint);
          setChatMessageBackground(element,message,appearance);
          setChatMessageTextColor(element,message,appearance);
          syncFloatingNameplateNotch(element);
        }
      });
    },
    removeUser(target: { sourceId?:string; userId?: string; username?: string }) {
      forgetAuthor(target,scene);
      for (const [id, ghost] of afterimages) {
        if (matchingSource(ghost.sourceId,target.sourceId) && matchingUser(ghost.user, target)) cancelGhost(id);
      }
      scene.removeMatching(item => matchingSource(item.value.sourceId,target.sourceId) &&
        (matchingUser(item.value.user,target)||[...(grouped.get(item.id)?.members.values()??[])].some(user=>matchingUser(user,target))));
    },
    removeSource(sourceId:string){
      for(const [id,ghost] of afterimages)if(ghost.sourceId===sourceId)cancelGhost(id);
      scene.removeMatching(item=>item.value.sourceId===sourceId);
      const scope=sourceId.toLocaleLowerCase('en-US').slice(0,200);
      knownColors.delete(scope);
      aliasesById.delete(scope);
    },
    clear() {
      cancelAfterimages();
      reflow.configure({ enabled:false });
      scene.clear();repeats.clear();grouped.clear();aliases.clear();
      knownColors.clear();aliasesById.clear();waitingMentions.clear();watchedByRow.clear();
      reflow.configure({ enabled: layoutSettings.smoothReflow ?? false });
    },
    dispose() {
      disposed=true;
      if(pruneFrame !== undefined && typeof cancelAnimationFrame === 'function')cancelAnimationFrame(pruneFrame);
      pruneFrame=undefined;
      resizeObserver?.disconnect();
      appliedStyle.dispose();
      cancelAfterimages();
      scene.dispose();repeats.clear();grouped.clear();aliases.clear();
      knownColors.clear();aliasesById.clear();waitingMentions.clear();watchedByRow.clear();
      for (const stop of [...activeScrambles]) stop();
      for (const stop of [...activeTypewriters]) stop();
      reflow.dispose();
    },
  };
}

/** A base emote wall, open to replacement physics and visual effects. */
export function createEmoteWall(root: HTMLElement, settings: EmoteWallSettings = {}) {
  let size = clamp(settings.size ?? 48, 12, 240, 48);
  let emojiService: WallEmojiService = settings.emojiService ?? 'off';
  let wallGifs=settings.wallGifs===true;
  let motion: WallMotion = settings.motion ?? 'float';
  let renderArtwork = settings.renderArtwork;
  let entrance: WallEntrance = settings.wallEnter ?? 'none';
  let exit: WallExit = settings.wallExit ?? 'none';
  let entranceMs = clamp(settings.wallEnterMs ?? 340, 100, 1500, 340);
  let exitMs = clamp(settings.wallExitMs ?? 260, 100, 1500, 260);
  let speed = clamp(settings.wallSpeed ?? 1, 0.25, 4, 1);
  let distance = clamp(settings.wallDistance ?? 24, 0, 160, 24);
  let spawn = settings.spawn ?? 'full';
  let fieldMode = settings.wallField ?? 'none';
  let activeEchoes = 0;
  let activeCinematicEntrances = 0;
  let activeCinematicExits = 0;
  let appliedWallStyle=applyWallStylePack(root,settings.wallStyle??'original');
  let color=normalizeWallColor(settings.wallColor);
  let finish=normalizeWallFinish(settings.wallFinish);
  let appliedAesthetics=applyWallAesthetics(root,color,finish);
  const MAX_ECHO_PRINTS = 12;
  const MAX_COMPLEX_ANIMATIONS = 8;
  const field = createConstellationField(root);
  field.setEnabled(fieldMode === 'constellation');
  const collisions = createWallCollisions(root);
  collisions.setSpeed(speed);
  collisions.setEnabled(motion === 'collide' && fieldMode === 'none');
  const relocate = new Map<string, () => void>();
  const position = (id: string): { left: number; top: number } => {
    const x = hash(id) % 1000 / 1000;
    const y = hash(id + ':y') % 1000 / 1000;
    if (spawn === 'top') return { left: 4 + x * 88, top: 3 + y * 22 };
    if (spawn === 'bottom') return { left: 4 + x * 88, top: 70 + y * 25 };
    if (spawn === 'edges') return (hash(id + ':edge') % 2 === 0)
      ? { left: x < 0.5 ? 3 : 91, top: 4 + y * 90 }
      : { left: 4 + x * 88, top: y < 0.5 ? 3 : 91 };
    return { left: 4 + x * 88, top: 4 + y * 80 };
  };
  const scene = createScene<{ art: EmoteArtwork; index: number; user: DisplayMessage['user']; sourceId?:string; chorus?: boolean }>({
    root,
    exitOnOverflow: true,
    ...(settings.maxActive !== undefined ? { maxActive: settings.maxActive } : {}),
    ...(settings.ttlMs !== undefined ? { ttlMs: settings.ttlMs } : {}),
    ...(settings.overflow !== undefined ? { overflow: settings.overflow } : {}),
    render({ art, chorus }, id) {
      const element = document.createElement('div');
      element.dataset.wallItem = id;
      if (chorus) element.dataset.wallChorus = 'true';
      if(art.provider==='twitch-gif')element.dataset.wallMedia='gif';
      element.dataset.motion = fieldMode === 'constellation' ? 'still' : motion;
      element.className = 'overlay-wall-item';
      element.style.position = 'absolute';
      element.style.pointerEvents = 'none';
      const initialPlacement = position(id);
      element.style.left = initialPlacement.left + '%';
      element.style.top = initialPlacement.top + '%';
      element.style.setProperty('--wall-distance', distance + 'px');
      element.style.setProperty('--wall-period', (7 / speed) + 's');
      // Deterministic negative phase spreads looping emotes around their paths.
      element.style.setProperty('--wall-phase', -(hash(id + ':phase') % 1000 / 1000 * 7 / speed) + 's');
      // Let the art's intrinsic aspect ratio set width; this outer wall
      // entity must not reintroduce a square clipping/placement box.
      element.style.height = size + 'px';
      element.style.width = 'max-content';
      const artwork = renderArtwork
        ? renderArtwork(art, size)
        : { element: createEmoteArtwork(art, size) };
      if(art.provider==='twitch-gif'){
        // A panorama must not overrun the scene. Keep its natural image ratio,
        // but cap its visible footprint independently from regular emotes.
        const img=artwork.element.querySelector('img');
        if(img)img.style.maxWidth=Math.min(240,Math.max(48,size*3))+'px';
      }
      const visual = document.createElement('div');
      visual.className = 'overlay-wall-visual';
      const selectedEntrance = chorus ? 'pop' : entrance;
      visual.dataset.wallEnter = selectedEntrance;
      visual.dataset.wallExit = exit;
      visual.style.width = 'max-content';
      visual.style.height = '100%';
      visual.style.setProperty('--wall-enter-duration', entranceMs + 'ms');
      visual.style.setProperty('--wall-exit-duration', exitMs + 'ms');
      visual.append(artwork.element);
      element.append(visual);
      const echoAllowed = selectedEntrance === 'echo-print' && activeEchoes < MAX_ECHO_PRINTS;
      if (selectedEntrance === 'echo-print' && !echoAllowed) visual.dataset.wallEnter = 'pop';
      if (echoAllowed) activeEchoes++;
      const cinematicAllowed = isCinematicEntrance(selectedEntrance)
        && activeCinematicEntrances < MAX_COMPLEX_ANIMATIONS
        && (selectedEntrance !== 'assemble' || canFragmentArtwork(visual));
      if (isCinematicEntrance(selectedEntrance) && !cinematicAllowed) visual.dataset.wallEnter = 'pop';
      if (cinematicAllowed) activeCinematicEntrances++;
      const stopCinematicEntrance = cinematicAllowed && isCinematicEntrance(selectedEntrance)
        ? mountCinematicEntrance(visual, selectedEntrance, entranceMs,
          () => { activeCinematicEntrances--; }) : undefined;
      const stopEcho = echoAllowed
        ? mountEchoPrint(visual, artwork.element, () => { activeEchoes--; }) : undefined;
      field.track(id, element);
      collisions.track(id, element);
      const lifecycleExit = exit;
      const lifecycleExitMs = exitMs;

      // The width cannot be known until the image loads (and can change on
      // source/viewport resize). Place based on its *rendered* dimensions,
      // rather than clipping panoramic art against the right edge.
      const contain = () => {
        const placement=position(id);
        const width = root.clientWidth;
        const height = root.clientHeight;
        const itemWidth = element.offsetWidth;
        const itemHeight = element.offsetHeight;
        if (width > 0 && itemWidth > 0) {
          const room = Math.max(0, width - itemWidth);
          const margin = ['float','orbit','sway','flutter'].includes(motion)
            ? Math.min(distance, room / 2) : 0;
          const x = Math.max(margin, Math.min(width * placement.left / 100, room - margin));
          element.style.left = x + 'px';
        }
        if (height > 0 && itemHeight > 0) {
          const room = Math.max(0, height - itemHeight);
          const margin = motion === 'float' || motion === 'bounce' || motion === 'orbit' || motion === 'flutter'
            ? Math.min(distance, room / 2) : 0;
          const y = Math.max(margin, Math.min(height * placement.top / 100, room - margin));
          element.style.top = y + 'px';
        }
        if (width > 0 && height > 0 && itemWidth > 0 && itemHeight > 0) {
          field.anchor(id, parseFloat(element.style.left), parseFloat(element.style.top), itemWidth, itemHeight);
          collisions.relocate(id);
        }
      };
      relocate.set(id, contain);
      const observer = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(contain) : null;
      observer?.observe(root);
      observer?.observe(element);
      return {
        element,
        exit: (done: () => void) => {
          collisions.untrack(id, true);
          stopEcho?.();
          stopCinematicEntrance?.();
          const allowed = isCinematicExit(lifecycleExit)
            && activeCinematicExits < MAX_COMPLEX_ANIMATIONS
            && (lifecycleExit !== 'shatter' || canFragmentArtwork(visual));
          const chosenExit = isCinematicExit(lifecycleExit) && !allowed ? 'shrink' : lifecycleExit;
          if (chosenExit !== lifecycleExit) visual.dataset.wallExit = chosenExit;
          if (allowed) activeCinematicExits++;
          let released = false;
          const release = () => {
            if (!released && allowed) { released=true; activeCinematicExits--; }
          };
          const cleanup = startWallExit(visual, chosenExit, lifecycleExitMs,
            () => { release(); done(); });
          return () => { cleanup(); release(); };
        },
        dispose: () => {
          relocate.delete(id);
          stopCinematicEntrance?.();
          field.untrack(id);
          collisions.untrack(id);
          stopEcho?.();
          observer?.disconnect();
          artwork.dispose?.();
        },
      };
    },
  });
  return {
    receive(message: DisplayMessage): number {
      let accepted = 0;
      const arts = extractEmotes(message);
      if(wallGifs && message.platform==='twitch'){
        let count=0;
        for(const part of message.parts){
          if(part.type!=='media'||part.mediaType!=='gif'||++count>4)continue;
          try{
            const url=new URL(part.url);
            if(url.protocol!=='https:'||url.username||url.password||
              !(url.hostname==='giphy.com'||url.hostname.endsWith('.giphy.com')))continue;
          }catch{continue;}
          arts.push({id:'twitch-gif:'+count,code:part.alt??part.text,
            provider:'twitch-gif',animated:true,url:part.url,overlays:[],modifiers:[]});
        }
      }
      if (emojiService !== 'off') {
        // Unicode emojis come from actual text fragments, never emote codes.
        // Bound additional artwork from a single message like other scene inputs.
        let added = 0;
        for (const part of message.parts) {
          if (part.type !== 'text' && part.type !== 'mention') continue;
          for (const segment of splitEmojiText(part.text)) {
            if (segment.type !== 'emoji') continue;
            if (++added > 24) break;
            arts.push({
              id: 'unicode:' + segment.text, code: segment.text,
              url: emojiImageUrl(segment.text, emojiService) ?? '',
              provider: 'unicode-emoji', emojiService,
              overlays: [], modifiers: [],
            });
          }
          if (added > 24) break;
        }
      }
      arts.forEach((art, index) => {
        if (scene.emit({ id: message.id + ':emote:' + index, value: { art, index, user: message.user, sourceId:message.sourceId } })) accepted++;
      });
      return accepted;
    },
    /** Optional bounded visual reaction. No synthetic chat message is emitted. */
    reactToChant(message: DisplayMessage, art: EmoteArtwork, count = 6): number {
      if (!extractEmotes(message).some(candidate=>
        candidate.id===art.id && candidate.provider===art.provider && candidate.url===art.url)) return 0;
      const quantity=Number.isFinite(count)?Math.max(0,Math.min(6,Math.floor(count))):0;
      let accepted=0;
      for(let index=0;index<quantity;index++){
        if(scene.emit({id:message.id+':emote:chorus:'+index,
          value:{art,index,user:message.user,sourceId:message.sourceId,chorus:true}}))accepted++;
      }
      return accepted;
    },
    configure(patch: EmoteWallSettings) {
      if(patch.wallStyle!==undefined && patch.wallStyle!==root.dataset.wallStyle) {
        appliedWallStyle.dispose();
        appliedWallStyle=applyWallStylePack(root,patch.wallStyle);
      }
      if(patch.wallColor!==undefined || patch.wallFinish!==undefined) {
        color=patch.wallColor!==undefined?normalizeWallColor(patch.wallColor):color;
        finish=patch.wallFinish!==undefined?normalizeWallFinish(patch.wallFinish):finish;
        appliedAesthetics.dispose();
        appliedAesthetics=applyWallAesthetics(root,color,finish);
      }
      if (patch.size !== undefined) {
        size = clamp(patch.size, 12, 240, 48);
        for(const item of scene.snapshot()){
          scene.patch(item.id,(_value,element)=>{element.style.height=size+'px';});
          relocate.get(item.id)?.();
        }
      }
      if (patch.emojiService !== undefined) emojiService = patch.emojiService;
      if (patch.wallGifs !== undefined) wallGifs=patch.wallGifs===true;
      if (patch.motion !== undefined) motion = patch.motion;
      if (patch.wallEnter !== undefined) entrance = patch.wallEnter;
      if (patch.wallExit !== undefined) exit = patch.wallExit;
      if (patch.wallEnterMs !== undefined) entranceMs = clamp(patch.wallEnterMs, 100, 1500, 340);
      if (patch.wallExitMs !== undefined) exitMs = clamp(patch.wallExitMs, 100, 1500, 260);
      if (patch.wallSpeed !== undefined) {
        speed = clamp(patch.wallSpeed, 0.25, 4, 1);
        collisions.setSpeed(speed);
      }
      if (patch.wallDistance !== undefined) distance = clamp(patch.wallDistance, 0, 160, 24);
      if (patch.wallField !== undefined) {
        fieldMode = patch.wallField;
        field.setEnabled(fieldMode === 'constellation');
      }
      if (patch.motion !== undefined || patch.wallSpeed !== undefined
          || patch.wallDistance !== undefined || patch.wallField !== undefined) {
        for (const item of scene.snapshot()) {
          scene.patch(item.id, (_value, element) => {
            if (patch.motion !== undefined || patch.wallField !== undefined)
              element.dataset.motion = fieldMode === 'constellation' ? 'still' : motion;
            element.style.setProperty('--wall-distance', distance + 'px');
            element.style.setProperty('--wall-period', (7 / speed) + 's');
            element.style.setProperty('--wall-phase', -(hash(item.id + ':phase') % 1000 / 1000 * 7 / speed) + 's');
          });
          relocate.get(item.id)?.();
        }
      }
      collisions.setEnabled(motion === 'collide' && fieldMode === 'none');
      if (patch.spawn !== undefined) {spawn = patch.spawn;for(const item of scene.snapshot())relocate.get(item.id)?.();}
      if (patch.renderArtwork !== undefined) renderArtwork = patch.renderArtwork;
      scene.configure(patch);
    },
    snapshot: scene.snapshot,
    remove: scene.remove,
    removeMessage(id: string) {
      scene.removeMatching(item => item.id.startsWith(id + ':emote:'));
    },
    removeUser(target: { sourceId?:string; userId?: string; username?: string }) {
      scene.removeMatching(item => matchingSource(item.value.sourceId,target.sourceId) && matchingUser(item.value.user, target));
    },
    removeSource(sourceId:string){scene.removeMatching(item=>item.value.sourceId===sourceId);},
    clear: scene.clear,
    dispose() { scene.dispose(); collisions.dispose(); field.dispose(); appliedWallStyle.dispose(); appliedAesthetics.dispose(); },
  };
}
