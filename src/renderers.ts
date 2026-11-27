import {kickRoleArtworkKey,kickRoleImageUrl} from '@myrqyry/chatbus/kick-artwork';
import { loadGoogleFont, normalizeGoogleFontFamily } from './google-fonts';
import { appendEmojiText, createEmojiNode, type EmojiService } from './emoji-service';
import type { ChatEntrance, ChatExit } from './chat-motion';
import { decorateChatLetters, LETTER_STAGGER_MS, typewriterStepMs, type LetterEnter, type LetterExit } from './letter-motion';
export type { ChatEntrance, ChatExit } from './chat-motion';
import type { DisplayMessage, EmoteArtwork, DisplayNamePaint, DisplayBadge, DisplayPaintGradient, DisplayPaintLayer } from './chatbus';

/** Relative and HTTPS asset URLs are supported; executable schemes are rejected. */
export function safeImageUrl(input: string): string | undefined {
  try {
    const url = new URL(input, document.baseURI);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function safeColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined;
}
/** Official FFZ effects; unused/reserved bits intentionally have no presentation. */
const FFZ_FLAGS = {
  hidden: 1, flipX: 2, flipY: 4, growX: 8, rainbow: 2048,
  hyperRed: 4096, hyperShake: 8192, cursed: 16384, jam: 32768, bounce: 65536,
} as const;
const FFZ_KNOWN = Object.values(FFZ_FLAGS).reduce((mask, value) => mask | value, 0);
const validFfzFlags = (value: number | undefined): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value & FFZ_KNOWN : 0;

export function createEmoteArtwork(
  art: EmoteArtwork,size = 36,inlineAlign:'middle'|'text-bottom'|'baseline'|'-0.12em'='middle',
): HTMLElement {
  const root = document.createElement('span');
  root.className = 'overlay-emote';
  root.dataset.code = art.code;
  if (art.provider === 'unicode-emoji' && art.emojiService) {
    root.dataset.unicodeEmoji = art.emojiService;
    root.style.height = size + 'px';
    root.style.fontSize = `min(${size}px, var(--chat-emote-height-limit, ${size}px))`;
    root.style.lineHeight = '1';
    root.style.display = 'inline-block';
    root.style.verticalAlign = inlineAlign;
    root.style.whiteSpace = 'nowrap';
    root.append(createEmojiNode(art.code, art.emojiService));
    return root;
  }
  root.dataset.modifiers = art.modifiers.map(x => x.code).join(',');
  const rawFlags = [...art.modifiers.map(x => x.flags), ...art.overlays.map(x => x.flags)]
    .reduce<number>((mask, value) => mask | (
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
    ), 0);
  root.dataset.modifierFlags = String(rawFlags);
  const flags = rawFlags & FFZ_KNOWN;
  // Intrinsic base width determines layout. Effects use nested wrappers so
  // transforms and filter animations cannot override one another or wall styles.
  root.style.height = String(size) + 'px';
  root.style.width = 'max-content';
  root.style.position = 'relative';
  root.style.display = 'inline-block';
  root.style.verticalAlign = inlineAlign;

  const visualFlags = flags & ~FFZ_FLAGS.hidden;
  const stage = visualFlags ? document.createElement('span') : root;
  if (visualFlags) {
    stage.style.display = 'inline-block';
    stage.style.position = 'relative';
    stage.style.height = '100%';
    stage.style.verticalAlign = 'top';
  }
  const add = (code: string, source: string, overlay: boolean): HTMLImageElement | undefined => {
    const src = safeImageUrl(source);
    if (!src) return undefined;
    const img = document.createElement('img');
    img.src = src;
    img.alt = overlay ? '' : code;
    img.draggable = false;
    img.style.height = '100%';
    img.style.width = overlay ? '100%' : 'auto';
    img.style.maxWidth = 'none';
    img.style.objectFit = 'contain';
    if (overlay) {
      img.setAttribute('aria-hidden', 'true');
      img.dataset.overlayLayer = 'true';
      img.style.position = 'absolute';
      img.style.inset = '0';
    }
    stage.append(img);
    return img;
  };
  const base = add(art.code, art.url, false);
  for (const layer of art.overlays) {
    // FFZ Hidden is a control effect, not another image layer.
    if (!(validFfzFlags(layer.flags) & FFZ_FLAGS.hidden))
      add(layer.code, layer.url, true);
  }
  if (visualFlags) {
    const effects: string[] = [];
    if (flags & FFZ_FLAGS.growX) effects.push('grow-x');
    if (flags & (FFZ_FLAGS.flipX | FFZ_FLAGS.flipY)) effects.push('flip');
    if (flags & FFZ_FLAGS.hyperShake) effects.push('hyper-shake');
    if (flags & FFZ_FLAGS.jam) effects.push('jam');
    if (flags & FFZ_FLAGS.bounce) effects.push('bounce');
    if (flags & FFZ_FLAGS.rainbow) effects.push('rainbow');
    if (flags & FFZ_FLAGS.hyperRed) effects.push('hyper-red');
    if (flags & FFZ_FLAGS.cursed) effects.push('cursed');
    let node: HTMLElement = stage;
    for (let index = effects.length - 1; index >= 0; index--) {
      const wrapper = document.createElement('span');
      wrapper.dataset.ffzEffect = effects[index]!;
      if (effects[index] === 'flip') {
        wrapper.dataset.flip = (flags & FFZ_FLAGS.flipX)
          ? (flags & FFZ_FLAGS.flipY ? 'xy' : 'x') : 'y';
      }
      wrapper.style.height = '100%';
      wrapper.style.display = 'inline-block';
      wrapper.style.position = 'relative';
      wrapper.style.verticalAlign = 'top';
      wrapper.append(node);
      node = wrapper;
    }
    root.append(node);
  }
  if (base && flags & FFZ_FLAGS.growX) {
    // CSS transforms do not reserve layout space. Reserve real doubled width
    // after image load, keeping the source's intrinsic (non-square) ratio.
    const updateWidth = () => {
      if (base.naturalWidth > 0 && base.naturalHeight > 0)
        root.style.width = String(size * 2 * base.naturalWidth / base.naturalHeight) + 'px';
    };
    if (base.complete && base.naturalWidth > 0) updateWidth();
    else base.addEventListener('load', updateWidth, {once: true});
  }
  return root;
}
export type ChatFont = 'system' | 'rounded' | 'mono' | 'serif';
export type ChatShadow = 'none' | 'soft' | 'strong';
export const CHAT_FONT_STACKS: Record<ChatFont, string> = {
  system: "'Segoe UI', Inter, sans-serif",
  rounded: "'Trebuchet MS', Verdana, sans-serif",
  mono: "'DejaVu Sans Mono', Consolas, monospace",
  serif: "Georgia, 'Times New Roman', serif",
};
export type KickRoleArtwork = Partial<Record<'moderator'|'verified'|'gift-1'|'gift-25',string>>;
export interface ChatAppearance {
  /** Optional local, user-supplied role images; never part of the chat wire. */
  kickRoleArtwork?: KickRoleArtwork;
  fontSize?: number;
  usernameSize?: number;
  textColorSource?: 'theme' | 'user-color' | 'name-paint';
  googleFont?: string;
  emoteSize?: number;
  emojiService?: EmojiService;
  showBadges?: boolean;
  showPlatformBadges?: boolean;
  showSourceBadges?: boolean;
  showViewerBadges?: boolean;
  showRoleBadges?: boolean;
  showSubscriberBadges?: boolean;
  showGifterBadges?: boolean;
  showCosmeticBadges?: boolean;
  showNames?: boolean;
  showTimestamp?: boolean;
  linkDisplay?:'compact'|'domain'|'hidden'|'full';
  nameplateStyle?: 'inline' | 'floating';
  newLineAfterUsername?: boolean;
  /** Alignment of username/badges and message text inside its bubble. */
  textAlign?: 'left' | 'center' | 'right';
  background?: string;
  textColor?: string;
  fontFamily?: ChatFont;
  stroke?: number;
  shadow?: ChatShadow;
  lineHeight?: number;
  backgroundAlpha?: number;
  messageBackground?: 'theme' | 'user-color' | 'name-paint';
  /** Paint-only blur radius. Never applied to text, emotes or the outline. */
  messagePaintBlur?: number;
  messageOutline?: number;
  radius?: number;
  enter?: ChatEntrance;
  exit?: ChatExit;
  enterMs?: number;
  exitMs?: number;
  letterEnter?: LetterEnter;
  /** Independent duration per letter. Falls back to legacy message timing. */
  letterEnterMs?:number;
  letterExit?: LetterExit;
  /** Per-feed observed identity colors; never a global cross-channel lookup. */
  resolveMentionColor?: (identity:{username?:string;userId?:string;text:string})=>string|undefined;
}
function between(value: number | undefined, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}
/** Presentation-only recognition of literal @handles in provider text
 * fragments (Kick and other transports may not emit structured mentions).
 * This never alters normalized Chatbus source fragments or emote artwork.
 * Visible URL shortening, when selected, happens separately and first.
 */
const LITERAL_MENTION=/(^|[^\p{L}\p{N}._/@])@([\p{L}\p{N}_-]{1,40})/gu;
const MAX_MENTIONS_PER_MESSAGE=12;

function createMentionElement(
  identity:{text:string;username?:string;userId?:string},
  appearance:ChatAppearance,
  structured=false,
):HTMLElement {
  const span=document.createElement('span');
  span.dataset.mention='true';
  if(identity.username){
    span.dataset.mentionUsername=identity.username;
    // Preserve the preexisting DOM attribute for Chatbus-supplied mentions;
    // free-text candidate @handles should not acquire extra legacy semantics.
    if(structured)span.dataset.username=identity.username;
  }
  if(identity.userId)span.dataset.mentionUserId=identity.userId;
  // The author may have a 7TV gradient text fill. A mention explicitly
  // overrides the inherited fill only when its target color is verified.
  const color=safeColor(appearance.resolveMentionColor?.(identity));
  if(color){
    span.style.color=color;
    span.style.webkitTextFillColor=color;
  }
  appendEmojiText(span,identity.text,appearance.emojiService ?? 'system');
  return span;
}

/** Keep unknown @names as plain-looking spans, so they can be colored in
 * place if that user speaks later. Preserve exact original message text.
 */
function appendTextWithMentions(content:HTMLElement,text:string,appearance:ChatAppearance,count:{value:number}):void {
  LITERAL_MENTION.lastIndex=0;
  let cursor=0;
  for(const match of text.matchAll(LITERAL_MENTION)){
    if(count.value>=MAX_MENTIONS_PER_MESSAGE)break;
    const prefix=match[1]??'';
    const username=match[2]!;
    const start=match.index+prefix.length;
    if(start<cursor)continue;
    // A URL query can contain ?q=@handle even though the @ is preceded by
    // punctuation. Keep URLs wholly literal, just like email addresses and
    // path fragments, rather than treating those bytes as live mentions.
    const precedingToken=text.slice(0,start).match(/\S+$/u)?.[0]??'';
    if(/(?:https?:\/\/|www\.)/iu.test(precedingToken))continue;
    if(start>cursor)appendEmojiText(content,text.slice(cursor,start),appearance.emojiService ?? 'system');
    const literal='@'+username;
    content.append(createMentionElement({text:literal,username},appearance));
    count.value++;
    cursor=start+literal.length;
  }
  if(cursor<text.length)appendEmojiText(content,text.slice(cursor),appearance.emojiService ?? 'system');
}

/** In OBS chat, URLs are visual references, not usable controls. Keep the
 * real hostname visible and strip long tracking/query strings from *display*
 * only; never mutate the normalized Chatbus message or navigate anywhere.
 * Parsing happens before mention detection so @handles inside URLs do not
 * accidentally receive mention styling. Restrict work per message to resist
 * spam/bursts; unmatched or unsupported links remain ordinary text.
 */
const CHAT_URL_CANDIDATE=/(?:https?:\/\/|www\.)[^\s<>"'`]+/giu;
const MAX_CHAT_LINKS=12;
const truncateChatUrl=(candidate:string):string=>{
  let end=candidate.length;
  while(end>0){
    const last=candidate[end-1]!;
    if(/[.,!?;:\]\}]/u.test(last)){end--;continue;}
    if(last===')'){
      const token=candidate.slice(0,end);
      const opened=(token.match(/\(/gu)??[]).length;
      const closed=(token.match(/\)/gu)??[]).length;
      if(closed>opened){end--;continue;}
    }
    break;
  }
  return candidate.slice(0,end);
};
const parseChatLink=(literal:string):URL|undefined=>{
  try{
    const url=new URL(/^www\./iu.test(literal)?'https://'+literal:literal);
    // Deliberately reject userinfo URLs: hiding a pasted username/password
    // in a compact label would be surprising and potentially misleading.
    if((url.protocol!=='https:'&&url.protocol!=='http:')||
      !url.hostname || url.username || url.password)return undefined;
    if(!/^\[[0-9a-f:]+\]$/iu.test(url.host) && !url.hostname.includes('.')
        && url.hostname!=='localhost')return undefined;
    return url;
  }catch{return undefined;}
};
const compactChatLink=(url:URL,display:'compact'|'domain'|'hidden'):string=>{
  if(display==='hidden')return '↗ link';
  const host=url.host.replace(/^www\./iu,'');
  if(display==='domain')return '↗ '+host;
  const segments=url.pathname.split('/').filter(Boolean);
  if(!segments.length)return '↗ '+host;
  const first=segments[0]!;
  const short=first.length>20 ? first.slice(0,19)+'…' : first;
  return '↗ '+host+'/'+short+(segments.length>1?'/…':'');
};
function appendOverlayLinks(
  content:HTMLElement,text:string,appearance:ChatAppearance,mentions:{value:number},linkCount:{value:number},
):void {
  if(appearance.linkDisplay==='full'){
    appendTextWithMentions(content,text,appearance,mentions);
    return;
  }
  const display=appearance.linkDisplay??'compact';
  let cursor=0;
  for(const match of text.matchAll(CHAT_URL_CANDIDATE)){
    if(linkCount.value>=MAX_CHAT_LINKS)break;
    const start=match.index;
    if(start<cursor)continue;
    // Don't mistake part of an email address (or a word) for a bare URL.
    if(start>0 && /[\p{L}\p{N}_@]/u.test(text[start-1]!))continue;
    const literal=truncateChatUrl(match[0]);
    const parsed=parseChatLink(literal);
    if(!parsed)continue;
    if(start>cursor)appendTextWithMentions(content,text.slice(cursor,start),appearance,mentions);
    const span=document.createElement('span');
    span.dataset.overlayLink='true';
    span.dataset.originalUrl=literal;
    span.dataset.linkHost=parsed.hostname;
    span.title=literal;
    span.style.overflowWrap='anywhere';
    span.style.textDecoration='underline dotted';
    span.style.textUnderlineOffset='.12em';
    span.textContent=compactChatLink(parsed,display);
    content.append(span);
    linkCount.value++;
    cursor=start+literal.length;
  }
  if(cursor<text.length)appendTextWithMentions(content,text.slice(cursor),appearance,mentions);
}

export function updateChatMentionColors(
  row:HTMLElement,
  resolve:(identity:{username?:string;userId?:string;text:string})=>string|undefined,
):void {
  for(const span of Array.from(row.querySelectorAll<HTMLElement>('[data-mention="true"]'))){
    const color=safeColor(resolve({
      text:span.textContent??'',
      username:span.dataset.mentionUsername,
      userId:span.dataset.mentionUserId,
    }));
    span.style.color=color??'';
    span.style.webkitTextFillColor=color??'';
  }
}

export function extractEmotes(message: DisplayMessage): EmoteArtwork[] {
  return message.parts.flatMap(part => part.type === 'emote' ? [part.emote] : []);
}
/** Classify stable normalized badge metadata, not translated display text or URLs. */
export function badgeVisible(badge:DisplayBadge,appearance:ChatAppearance={}):boolean {
  if(appearance.showBadges===false)return false;
  const provider=badge.provider?.toLowerCase()??'';
  const id=badge.id?.toLowerCase()??'';
  if(provider==='twitch-source'||provider==='kick-source')return appearance.showSourceBadges!==false;
  if(provider==='twitch-user')return appearance.showViewerBadges!==false;
  if(['sub_gifter','gifter','gift','subgift','submysterygift'].includes(id))
    return appearance.showGifterBadges!==false;
  if(['subscriber','founder','sub'].includes(id))
    return appearance.showSubscriberBadges!==false;
  if(['7tv','bttv','ffz'].includes(provider))return appearance.showCosmeticBadges!==false;
  if(provider==='kick' && !['moderator','mod','vip','verified','broadcaster','staff','admin','bot','partner'].includes(id))
    return appearance.showCosmeticBadges!==false;
  return appearance.showRoleBadges!==false;
}
/** Preserve label occupancy through late badge/identity patches without
 * rebuilding a live message or leaving a phantom floating header gap.
 */
function syncChatHeaderOccupancy(header:HTMLElement):void {
  const empty=!header.querySelector('[data-username],.overlay-badge,.overlay-service-badge');
  header.dataset.empty=String(empty);
  const message=header.closest<HTMLElement>('.overlay-chat-message');
  if(message)message.dataset.nameplateEmpty=String(empty);
}
/** Rounded end caps that remain responsive to the bubble's width/height.
 * CSS path() takes absolute pixel coordinates, so a path computed before a
 * message expands or scales clips the right/bottom outlines. CSS shape() can
 * use percentage edges while keeping the cap curvature in CSS pixels.
 */
export function roundedFloatingNotchShape(
  width:number,height:number,start:number,end:number,depth:number,outline:number,
):string {
  const radius=Math.max(0,Math.min(outline/2,depth/2,(end-start)/4,start,width-end));
  const k=.5522847498307936; // Cubic Bezier quarter-circle approximation.
  const left=start-radius,right=end+radius;
  const f=(n:number)=>String(Number(n.toFixed(3)))+'px';
  const pt=(x:number,y:number)=>f(x)+' '+f(y);
  const segments=[
    'shape(from 0 0',
    'line to '+pt(left,0),
    'curve to '+pt(left+radius,radius)+' with '+pt(left+k*radius,0)+' / '+pt(left+radius,radius-k*radius),
    'curve to '+pt(left,2*radius)+' with '+pt(left+radius,radius+k*radius)+' / '+pt(left+k*radius,2*radius),
    'line to '+pt(left,depth),
    'line to '+pt(right,depth),
    'line to '+pt(right,2*radius),
    'curve to '+pt(right-radius,radius)+' with '+pt(right-k*radius,2*radius)+' / '+pt(right-radius,radius+k*radius),
    'curve to '+pt(right,0)+' with '+pt(right-radius,radius-k*radius)+' / '+pt(right-k*radius,0),
    'line to 100% 0',
    'line to 100% 100%',
    'line to 0 100%',
    'close)',
  ];
  return segments.join(', ');
}

/** Notch the painted outline instead of painting an opaque label backing.
 * Normal bubble borders keep their rounded-corner geometry. Each paint ring
 * is clipped to create a true, transparent gap around the live header.
 */
export function syncFloatingNameplateNotch(element:HTMLElement):void {
  if(element.dataset.nameplate!=='floating')return;
  const header=element.querySelector<HTMLElement>('.overlay-message-header');
  if(!header||header.dataset.empty==='true')return;
  const bounds=header.getBoundingClientRect();
  // Entrance transforms can temporarily scale a message down to zero. Its
  // *layout* still has dimensions, and ResizeObserver doesn't fire when only
  // transform changes. Initialize the clip from untransformed box geometry.
  const headerHasLayout=header.offsetWidth>0 && header.offsetHeight>0;
  if(!headerHasLayout && !(bounds.width>0&&bounds.height>0))return;
  // The floating header already has 6px of transparent inline padding.
  // Notch around the badge/name *ink* plus a small stroke allowance, not
  // around that padding plus half the font size. Large headers otherwise
  // erase the entire top-left straight segment beside the first badge.
  const outline=Number.parseFloat(element.style.borderWidth)||0;
  const clearance=Math.max(2,Math.min(6,outline+1));
  const paddingLeft=Number.parseFloat(getComputedStyle(header).paddingLeft)||0;
  const paddingRight=Number.parseFloat(getComputedStyle(header).paddingRight)||0;
  for(const ring of Array.from(element.querySelectorAll<HTMLElement>('[data-message-paint-outline]'))){
    const frame=ring.getBoundingClientRect();
    // Layout offsets are in local CSS pixels even while the row is being
    // scaled/rotated by entrance/exit animations. Viewport rectangles are
    // transformed and must not be used as clip-path pixel coordinates.
    const local=ring.offsetWidth>0 && headerHasLayout;
    if(!local && !(frame.width>0&&frame.height>0))continue;
    const frameWidth=local?ring.offsetWidth:frame.width;
    const frameHeight=local?ring.offsetHeight:frame.height;
    const left=local?header.offsetLeft-ring.offsetLeft:bounds.left-frame.left;
    const right=local?left+header.offsetWidth:bounds.right-frame.left;
    const start=Math.max(0,Math.min(frameWidth,left+paddingLeft-clearance));
    const end=Math.max(start,Math.min(frameWidth,right-paddingRight+clearance));
    // The horizontal nameplate crosses only the *top stroke* of the ring.
    // The old bounds.bottom-based depth removed a tall rectangle of the
    // left/right outline whenever the username or badges were large.
    const depth=Math.max(0,Math.min(frameHeight,outline+2));
    const px=(n:number)=>Number(n.toFixed(2))+'px';
    const polygon='polygon(0 0, '+px(start)+' 0, '+px(start)+' '+px(depth)+
      ', '+px(end)+' '+px(depth)+', '+px(end)+' 0, 100% 0, 100% 100%, 0 100%)';
    const rounded=roundedFloatingNotchShape(frameWidth,frameHeight,start,end,depth,outline);
    // Rounded shape() uses percentage right/bottom edges and survives resized
    // message/emote geometry. Never use absolute path(), even if supported:
    // stale path dimensions previously erased whole sides of live bubbles.
    // Older CEF builds that lack shape() retain the responsive polygon notch.
    ring.style.clipPath=typeof CSS!=='undefined' && typeof CSS.supports==='function' &&
      CSS.supports('clip-path',rounded) ? rounded : polygon;
  }
}
const nameplateObservers=new WeakMap<HTMLElement,()=>void>();
export function stopFloatingNameplateNotch(element:HTMLElement):void {
  nameplateObservers.get(element)?.();
  nameplateObservers.delete(element);
}
export function observeFloatingNameplateNotch(element:HTMLElement):void {
  stopFloatingNameplateNotch(element);
  if(element.dataset.nameplate!=='floating')return;
  const header=element.querySelector<HTMLElement>('.overlay-message-header');
  if(!header)return;
  if(typeof ResizeObserver==='undefined'){
    syncFloatingNameplateNotch(element);
    return;
  }
  const resizeObserver=new ResizeObserver(()=>syncFloatingNameplateNotch(element));
  resizeObserver.observe(element);
  resizeObserver.observe(header);
  // CSS font replacement and late-loading badge artwork both affect header size.
  // ResizeObserver owns geometry updates; no per-frame polling.
  const cleanup=()=>resizeObserver.disconnect();
  nameplateObservers.set(element,cleanup);
  syncFloatingNameplateNotch(element);
}
/** Keep badge imagery independently replaceable without recreating an animated chat row. */
export function setChatBadgeImages(
  element:HTMLElement,
  badges:readonly DisplayBadge[],
  appearance:ChatAppearance={},
  authorColor?:string,
):void {
  const container=element.querySelector<HTMLElement>('[data-badge-container]');
  if(!container)return;
  const nodes:HTMLElement[]=[];
  for(const badge of badges.slice(0,50).filter(badge=>badgeVisible(badge,appearance))) {
    const fallback=()=>{
      if(!badge.text || badge.text.length>24 || !/^[A-Z0-9 ]+$/.test(badge.text))return undefined;
      const chip=document.createElement('span');
      chip.className='overlay-badge overlay-badge-fallback';chip.dataset.badgeFallback='true';
      chip.textContent=badge.text;chip.setAttribute('aria-label',badge.name);chip.title=badge.name;
      if(badge.provider && /^[a-z0-9-]+$/.test(badge.provider))chip.dataset.provider=badge.provider;
      return chip;
    };
    const roleKey=badge.url?undefined:kickRoleArtworkKey({provider:badge.provider,id:badge.id,version:badge.text?.match(/^GIFT (1|25)$/)?.[1]});
    const acquired=roleKey?kickRoleImageUrl(badge.kickRoleSvg):undefined;
    const local=roleKey?appearance.kickRoleArtwork?.[roleKey]:undefined;
    const src=badge.url?safeImageUrl(badge.url):acquired??(local?safeImageUrl(local):undefined);
    if(src){
      const img=document.createElement('img');
      img.src=src;img.alt=badge.name;img.className='overlay-badge';
      if(badge.provider && /^[a-z0-9-]+$/.test(badge.provider))img.dataset.provider=badge.provider;
      // Portraits have different owners; never tint ordinary role badges.
      const isSource=badge.provider==='twitch-source'||badge.provider==='kick-source';
      const isViewer=badge.provider==='twitch-user'||badge.provider==='kick-user';
      const ringColor=safeColor(isSource?badge.color:isViewer?authorColor:undefined);
      if(ringColor)img.style.setProperty('--avatar-ring-color',ringColor);
      if(badge.tooltip)img.title=badge.tooltip;
      if(acquired||local)img.addEventListener('error',()=>{
        const chip=fallback();if(chip)img.replaceWith(chip);
        const header=container.closest<HTMLElement>('.overlay-message-header');
        if(header)syncChatHeaderOccupancy(header);
      },{once:true});
      nodes.push(img);continue;
    }
    const chip=fallback();if(chip)nodes.push(chip);
  }
  container.replaceChildren(...nodes);
  const header=container.closest<HTMLElement>('.overlay-message-header');
  if(header)syncChatHeaderOccupancy(header);
}
const SERVICE_LABELS:Record<string,string>={twitch:'Twitch',kick:'Kick',youtube:'YouTube',tiktok:'TikTok'};
export function createServiceBadge(platform:string|undefined):HTMLElement|null{
  const key=platform?.trim().toLowerCase();
  const label=key?SERVICE_LABELS[key]:undefined;
  if(!key||!label)return null;
  const badge=document.createElement('span');
  badge.className='overlay-service-badge';
  badge.dataset.platform=key;
  badge.setAttribute('aria-label',label);
  badge.title=label;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  if(key==='youtube') path.setAttribute('d','M8.2 7.1v9.8L16.7 12 8.2 7.1Z');
  else if(key==='tiktok') path.setAttribute('d','M14 3h3c.3 2.1 1.7 3.6 4 4v3a8 8 0 0 1-4-1.5V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3Z');
  else if(key==='twitch') path.setAttribute('d','M6 5h13v9l-4 4h-3l-2 2v-2H6V5Zm3 3v6h2V8H9Zm5 0v6h2V8h-2Z');
  // Original generic letterform, not Kick's proprietary wordmark geometry.
  else path.setAttribute('d','M6 4h3v7l7-7h4l-8 8 8 8h-4l-7-7v7H6Z');
  svg.append(path);badge.append(svg);
  return badge;
}
const cssArgb=(value:number,opacityMultiplier=1):string => {
  const v=value>>>0;
  const alpha=Math.max(0,Math.min(1,(v>>>24)/255*opacityMultiplier));
  return 'rgba(' + ((v>>>16)&255) + ',' + ((v>>>8)&255) + ',' + (v&255)
    + ',' + Number(alpha.toFixed(3)) + ')';
};

const percent=(value:number,min=0,max=1):string=>
  String(Number((Math.max(min,Math.min(max,value))*100).toFixed(3)))+'%';
const strictPaintImage=(value:string|undefined):string|undefined=>{
  if(!value||value.length>2048)return undefined;
  try{const url=new URL(value);return url.protocol==='https:'?'url('+JSON.stringify(url.href)+')':undefined;}
  catch{return undefined;}
};
const paintStops=(stops:readonly {at:number;color:number}[],opacity=1):string[]=>
  stops.slice(0,32).flatMap(stop=>Number.isFinite(stop.at)&&Number.isInteger(stop.color)
    ?[cssArgb(stop.color,opacity)+' '+percent(stop.at,-5,5)]:[]);
const paintLayerBackground=(layer:DisplayPaintLayer,flattenOpacity=false):string|undefined=>{
  // For CSS text-clipped fills, bake per-layer opacity into gradient colors:
  // unlike separate DOM paint layers, one CSS background stack has no per-layer
  // opacity property. Outlines and bubbles retain their existing paint path.
  const opacity=flattenOpacity?Math.max(0,Math.min(1,layer.opacity)):1;
  if(layer.kind==='solid')return 'linear-gradient('+cssArgb(layer.color,opacity)+', '+cssArgb(layer.color,opacity)+')';
  if(layer.kind==='image')return strictPaintImage(layer.url);
  const stops=paintStops(layer.stops,opacity);if(stops.length<2)return undefined;
  const repeat=layer.repeating?'repeating-':'';
  return layer.kind==='linear'
    ?repeat+'linear-gradient('+Math.max(-3600,Math.min(3600,layer.angle))+'deg, '+stops.join(', ')+')'
    :repeat+'radial-gradient('+(layer.shape==='ellipse'?'ellipse':'circle')+', '+stops.join(', ')+')';
};
const paintGradientBackground=(gradient:DisplayPaintGradient):string|undefined=>{
  if(gradient.function==='URL')return strictPaintImage(gradient.imageUrl);
  const stops=paintStops(gradient.stops);if(stops.length<2)return undefined;
  const repeat=gradient.repeat?'repeating-':'';
  return gradient.function==='LINEAR_GRADIENT'
    ?repeat+'linear-gradient('+Math.max(-3600,Math.min(3600,gradient.angle??0))+'deg, '+stops.join(', ')+')'
    :repeat+'radial-gradient('+(gradient.shape==='ellipse'?'ellipse':'circle')+', '+stops.join(', ')+')';
};
const hexWithOpacity=(value:string|undefined,opacity:number):string|undefined=>{
  const match=value?.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);if(!match)return undefined;
  let hex=match[1];if(hex.length<=4)hex=[...hex].map(x=>x+x).join('');
  const hasAlpha=hex.length===8;const alpha=(hasAlpha?parseInt(hex.slice(6,8),16)/255:1)*Math.max(0,Math.min(1,opacity));
  return `rgba(${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)}, ${Number(alpha.toFixed(3))})`;
};
const representativePaintColor=(paint:DisplayNamePaint|undefined):number|undefined=>{
  if(!paint)return undefined;
  for(const layer of paint.layers??[]){
    if(layer.kind==='solid')return layer.color;
    if(layer.kind!=='image'&&layer.stops[0])return layer.stops[0].color;
  }
  for(const gradient of paint.gradients??[])if(gradient.stops[0])return gradient.stops[0].color;
  return paint.color;
};
const paintArtwork=(paint:DisplayNamePaint|undefined,flattenOpacity=false)=>{
  // The same validated 7TV layers drive bubble fill, text and outline.
  // Layers take precedence over legacy gradients, preserving paint ordering.
  const layers=(paint?.layers??[]).slice(0,12).flatMap(layer=>{
    const background=paintLayerBackground(layer,flattenOpacity);
    return background?[{background,opacity:layer.opacity,gradient:undefined as DisplayPaintGradient|undefined,
      solidColor:layer.kind==='solid'?cssArgb(layer.color):undefined}]:[];
  });
  if(layers.length)return layers;
  return (paint?.gradients??[]).slice(0,5).flatMap(gradient=>{
    const background=paintGradientBackground(gradient);
    return background?[{background,opacity:1,gradient,solidColor:undefined as string|undefined}]:[];
  });
};
/** Style only the real message lettering, never the identity row or emote
 * images. Source paint is a projected Chatbus contract, not remote CSS.
 * The already validated gradients/images can form a CSS text-clipped fill.
 */
export function setChatMessageTextColor(
  element:HTMLElement,message:DisplayMessage,appearance:ChatAppearance={},
):void {
  const content=element.querySelector<HTMLElement>('.overlay-message-content');
  if(!content)return;
  content.style.color='';
  content.style.backgroundImage='';
  content.style.backgroundPosition='';
  content.style.backgroundSize='';
  content.style.backgroundRepeat='';
  content.style.backgroundClip='';
  content.style.webkitBackgroundClip='';
  content.style.webkitTextFillColor='';
  const source=appearance.textColorSource??'theme';
  element.dataset.textColorSource=source;
  if(source==='theme')return;
  const userColor=safeColor(message.user.color);
  if(source==='user-color'){
    if(userColor)content.style.color=userColor;
    return;
  }
  const paint=message.user.namePaint;
  const artwork=paintArtwork(paint,true);
  if(artwork.length){
    // CSS backgrounds stack top-first; 7TV provides ordered bottom-to-top
    // layers. Keep every safe visual layer, not just the first gradient stop.
    const topFirst=artwork.slice().reverse();
    content.style.backgroundImage=topFirst.map(layer=>layer.background).join(', ');
    content.style.backgroundPosition=topFirst.map(({gradient})=>gradient?.at
      ?percent(gradient.at[0])+' '+percent(gradient.at[1]):'0% 0%').join(', ');
    content.style.backgroundSize=topFirst.map(({gradient})=>gradient?.canvasSize
      ?percent(gradient.canvasSize[0])+' '+percent(gradient.canvasSize[1]):'auto').join(', ');
    content.style.backgroundRepeat=topFirst.map(({gradient})=>gradient?.canvasRepeat??'repeat').join(', ');
    content.style.backgroundClip='text';
    content.style.webkitBackgroundClip='text';
    content.style.webkitTextFillColor='transparent';
    return;
  }
  const solid=paint?.color!==undefined?cssArgb(paint.color):undefined;
  if(solid)content.style.color=solid;
  else if(userColor)content.style.color=userColor;
}
const clearMessagePaint=(element:HTMLElement)=>
  element.querySelectorAll('[data-message-paint-surface],[data-message-paint-layer],[data-message-paint-outline]')
    .forEach(layer=>layer.remove());
/** Keep only the namepaint fill inside a rounded clip. A paint group, rather
 * than a backdrop filter or a filter on the whole bubble, preserves crisp
 * letters, badges, emotes and separate rounded outlines. The overscanned
 * group prevents the blur kernel from introducing an artificial dark rim.
 * This DOM exists only when blur > 0; zero preserves the original path.
 */
const appendMessagePaintBlurSurface=(element:HTMLElement,blur:number):HTMLElement=>{
  const clip=document.createElement('span');
  clip.dataset.messagePaintSurface='true';
  clip.setAttribute('aria-hidden','true');
  Object.assign(clip.style,{
    position:'absolute',inset:'0',borderRadius:'inherit',overflow:'hidden',
    pointerEvents:'none',zIndex:'0',
  });
  const filtered=document.createElement('span');
  filtered.dataset.messagePaintBlur='true';
  Object.assign(filtered.style,{
    position:'absolute',inset:-blur+'px',
    borderRadius:'inherit',pointerEvents:'none',filter:'blur('+blur+'px)',
  });
  clip.append(filtered);
  const anchor=element.querySelector('.overlay-message-header');
  if(anchor)element.insertBefore(clip,anchor);else element.append(clip);
  return filtered;
};
const appendMessagePaintLayer=(element:HTMLElement,background:string,opacity:number,
  gradient?:DisplayPaintGradient,parent?:HTMLElement)=>{
  const layer=document.createElement('span');layer.dataset.messagePaintLayer='true';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'absolute',inset:'0',borderRadius:'inherit',pointerEvents:'none',zIndex:'0',backgroundImage:background,
    opacity:String(Number(Math.max(0,Math.min(1,opacity)).toFixed(3)))});
  if(gradient?.at)layer.style.backgroundPosition=percent(gradient.at[0])+' '+percent(gradient.at[1]);
  if(gradient?.canvasSize)layer.style.backgroundSize=percent(gradient.canvasSize[0])+' '+percent(gradient.canvasSize[1]);
  if(gradient?.canvasRepeat)layer.style.backgroundRepeat=gradient.canvasRepeat;
  if(parent)parent.append(layer);
  else{
    const anchor=element.querySelector('.overlay-message-header');
    if(anchor)element.insertBefore(layer,anchor);else element.append(layer);
  }
};
/** Clip a native rounded border for solid colors, or a sanitized CSS paint
 * mask for genuine gradients/images. Native border rasterization gives solid
 * strokes smooth, consistent inside/outside radii instead of compositor
 * artifacts from subtracting two rounded alpha masks.
 */
const appendMessagePaintOutline=(element:HTMLElement,background:string,opacity:number,
  outline:number,gradient?:DisplayPaintGradient,solidColor?:string)=>{
  const layer=document.createElement('span');
  layer.dataset.messagePaintOutline='true';
  layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{
    position:'absolute',inset:-outline+'px',boxSizing:'border-box',
    borderRadius:'inherit',pointerEvents:'none',zIndex:'2',
    opacity:String(Number(Math.max(0,Math.min(1,opacity)).toFixed(3))),
  });
  if(solidColor){
    layer.style.border=outline+'px solid '+solidColor;
  }else{
    layer.style.padding=outline+'px';
    layer.style.backgroundImage=background;
    layer.style.mask='linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
    layer.style.maskComposite='exclude';
    layer.style.webkitMaskComposite='xor';
    if(gradient?.at)layer.style.backgroundPosition=percent(gradient.at[0])+' '+percent(gradient.at[1]);
    if(gradient?.canvasSize)layer.style.backgroundSize=percent(gradient.canvasSize[0])+' '+percent(gradient.canvasSize[1]);
    if(gradient?.canvasRepeat)layer.style.backgroundRepeat=gradient.canvasRepeat;
  }
  const anchor=element.querySelector('.overlay-message-header');
  if(anchor)element.insertBefore(layer,anchor);else element.append(layer);
};
/** Apply a bounded per-message bubble fill without consuming provider-authored CSS. */
export function setChatMessageBackground(element:HTMLElement,message:DisplayMessage,appearance:ChatAppearance={}):void{
  clearMessagePaint(element);
  const alpha=between(appearance.backgroundAlpha,72,0,100)/100;
  const requested=appearance.messageBackground??'theme';
  const userColor=safeColor(message.user.color);
  const userFill=hexWithOpacity(userColor,alpha);
  const themeFill='rgba(16, 18, 27, '+alpha+')';
  element.style.backgroundImage='';element.style.backgroundColor='';
  let effective:NonNullable<ChatAppearance['messageBackground']>=requested;
  const paint=message.user.namePaint;
  const artwork=paintArtwork(paint);
  if(requested==='name-paint'){
    if(artwork.length){
      element.style.backgroundColor=userFill??themeFill;
      const blur=between(appearance.messagePaintBlur,0,0,48);
      // A uniform color stack has no spatial detail to soften. Likewise
      // invisible gradient/image layers cannot contribute to the fill.
      // Avoid allocating an overscanned filter surface for either case.
      const hasVisibleDetail=artwork.some(layer=>layer.solidColor===undefined
        && Number(Math.max(0,Math.min(1,alpha*layer.opacity)).toFixed(3))>0);
      const fillParent=blur>0&&hasVisibleDetail?appendMessagePaintBlurSurface(element,blur):undefined;
      for(const layer of artwork)
        appendMessagePaintLayer(element,layer.background,alpha*layer.opacity,layer.gradient,fillParent);
    }else if(paint?.color!==undefined){
      element.style.backgroundColor=cssArgb(paint.color,alpha);
    }else if(userFill){effective='user-color';element.style.backgroundColor=userFill;}
    else{effective='theme';element.style.backgroundColor=themeFill;}
  }else if(requested==='user-color'&&userFill){element.style.backgroundColor=userFill;}
  else if(requested==='user-color'){effective='theme';element.style.backgroundColor=themeFill;}
  else element.style.backgroundColor=themeFill;
  element.dataset.messageBackground=effective;

  const outline=between(appearance.messageOutline,0,0,8);
  if(outline>0){
    element.style.borderStyle='solid';element.style.borderWidth=outline+'px';
    if(artwork.length){
      // Color the whole rounded outline with the actual 7TV paint, not the
      // first stop. It remains independent of the selected bubble fill.
      element.style.borderColor='transparent';
      for(const layer of artwork)
        appendMessagePaintOutline(element,layer.background,layer.opacity,outline,layer.gradient,layer.solidColor);
    }else{
      const paintColor=representativePaintColor(paint);
      const color=paintColor!==undefined?cssArgb(paintColor):
        (effective!=='theme'&&userColor?userColor:'rgba(246, 240, 233, .42)');
      if(element.dataset.nameplate==='floating'){
        element.style.borderColor='transparent';
        appendMessagePaintOutline(element,'',1,outline,undefined,color);
      }else element.style.borderColor=color;
    }
  }else{
    element.style.borderStyle='';element.style.borderWidth='';element.style.borderColor='';
  }
}
/** CSS is constructed from a strictly projected paint contract, never remote CSS. */
export function setChatNamePaint(element:HTMLElement,paint?:DisplayNamePaint):void {
  const name=element.querySelector<HTMLElement>('[data-username]');
  if(!name)return;
  const wrapper=name.parentElement?.dataset.usernameWrap==='true' ? name.parentElement : null;
  wrapper?.querySelectorAll('[data-name-paint-layer]').forEach(layer=>layer.remove());
  if(wrapper){
    wrapper.style.filter='';
    // Reset to inherited OverlayKit shadow when the paint is removed.
    wrapper.style.textShadow='';
  }
  name.style.opacity='';
  name.style.color=name.dataset.baseColor??'';
  name.style.backgroundImage='';
  name.style.backgroundPosition='';
  name.style.backgroundSize='';
  name.style.backgroundRepeat='';
  name.style.backgroundClip='';
  name.style.webkitBackgroundClip='';
  name.style.webkitTextFillColor='';
  name.style.filter='';
  name.style.fontWeight='';
  name.style.fontVariant='';
  name.style.textTransform='';
  name.style.webkitTextStrokeWidth='';
  name.style.webkitTextStrokeColor='';
  name.style.textShadow='';
  if(!paint)return;

  const sizePercent=(value:number):string=>String(Number((Math.max(0,Math.min(1,value))*100).toFixed(3)))+'%';
  const stopPercent=(value:number):string=>String(Number((Math.max(-5,Math.min(5,value))*100).toFixed(3)))+'%';
  const imagePaint=(value:string|undefined):string|undefined=>{
    if(!value || value.length>2048)return undefined;
    try {
      const url=new URL(value);
      return url.protocol==='https:' ? 'url('+JSON.stringify(url.href)+')' : undefined;
    } catch {return undefined;}
  };
  const layerNodes:HTMLElement[]=[];
  if(wrapper && paint.layers?.length){
    for(const layer of paint.layers.slice(0,12)){
      let background:string|undefined;
      if(layer.kind==='solid'){
        const color=cssArgb(layer.color);
        background='linear-gradient('+color+', '+color+')';
      }else if(layer.kind==='image'){
        background=imagePaint(layer.url);
      }else{
        const stops=layer.stops.slice(0,32).flatMap(stop=>
          Number.isFinite(stop.at) && Number.isInteger(stop.color) &&
          stop.color>=0 && stop.color<=0xffffffff
            ? [cssArgb(stop.color)+' '+stopPercent(stop.at)] : []);
        if(stops.length>=2){
          const repeat=layer.repeating?'repeating-':'';
          background=layer.kind==='linear'
            ? repeat+'linear-gradient('+Math.max(-3600,Math.min(3600,layer.angle))+'deg, '+stops.join(', ')+')'
            : repeat+'radial-gradient('+(layer.shape==='ellipse'?'ellipse':'circle')+', '+stops.join(', ')+')';
        }
      }
      if(!background)continue;
      const layerNode=document.createElement('strong');
      layerNode.dataset.namePaintLayer='true';
      layerNode.setAttribute('aria-hidden','true');
      layerNode.textContent=name.textContent??'';
      layerNode.style.gridArea='1 / 1';
      layerNode.style.pointerEvents='none';
      layerNode.style.opacity=String(Math.max(0,Math.min(1,layer.opacity)));
      layerNode.style.backgroundImage=background;
      layerNode.style.backgroundClip='text';
      layerNode.style.webkitBackgroundClip='text';
      layerNode.style.webkitTextFillColor='transparent';
      layerNode.style.color='transparent';
      wrapper.append(layerNode);
      layerNodes.push(layerNode);
    }
    if(layerNodes.length)name.style.opacity='0';
  }

  const gradients=(paint.gradients??[]).slice(0,5).flatMap(g=>{
    if(g.function==='URL'){
      const image=imagePaint(g.imageUrl);
      return image?[{css:image,gradient:g}]:[];
    }
    if(g.function!=='LINEAR_GRADIENT'&&g.function!=='RADIAL_GRADIENT')return [];
    const stops=g.stops.slice(0,20).flatMap(stop=>
      Number.isFinite(stop.at) && Number.isInteger(stop.color) &&
      stop.color>=0 && stop.color<=0xffffffff
        ? [cssArgb(stop.color)+' '+stopPercent(stop.at)] : []);
    if(stops.length<2)return [];
    const repeat=g.repeat?'repeating-':'';
    const head=g.function==='LINEAR_GRADIENT'
      ? String(Math.max(-3600,Math.min(3600,g.angle??0)))+'deg'
      : g.shape==='ellipse'?'ellipse':'circle';
    const functionName=g.function==='LINEAR_GRADIENT'?'linear-gradient':'radial-gradient';
    return [{css:repeat+functionName+'('+head+', '+stops.join(', ')+')',gradient:g}];
  });
  if(!layerNodes.length && gradients.length){
    name.style.backgroundImage=gradients.map(g=>g.css).join(', ');
    name.style.backgroundPosition=gradients.map(({gradient:g})=>g.at
      ?sizePercent(g.at[0])+' '+sizePercent(g.at[1]):'0% 0%').join(', ');
    name.style.backgroundSize=gradients.map(({gradient:g})=>g.canvasSize
      ?sizePercent(g.canvasSize[0])+' '+sizePercent(g.canvasSize[1]):'auto').join(', ');
    name.style.backgroundRepeat=gradients.map(({gradient:g})=>g.canvasRepeat??'repeat').join(', ');
    name.style.backgroundClip='text';
    name.style.webkitBackgroundClip='text';
    name.style.webkitTextFillColor='transparent';
  } else if(!layerNodes.length && paint.color!==undefined) {
    name.style.color=cssArgb(paint.color);
  }

  if(layerNodes.length || gradients.length || paint.color!==undefined){
    // OverlayKit's shadow is inherited from the bubble. On a 7TV
    // text-clipped/transparent paint that dark shadow tints the fill itself,
    // making it look much darker than the separate bright outline. Suppress
    // only our inherited shadow for genuinely painted identities. Provider
    // paint/text shadow effects below may still supply their own styling.
    if(wrapper)wrapper.style.textShadow='none';
    name.style.textShadow='none';
    for(const layer of layerNodes)layer.style.textShadow='none';
  }

  if(paint.shadows?.length) {
    const shadowFilter=paint.shadows.slice(0,6).map(shadow=>
      'drop-shadow('+
      Math.max(-40,Math.min(40,shadow.xOffset))+'px '+
      Math.max(-40,Math.min(40,shadow.yOffset))+'px '+
      Math.max(0,Math.min(40,shadow.radius))+'px '+cssArgb(shadow.color)+')'
    ).join(' ');
    if(layerNodes.length && wrapper)wrapper.style.filter=shadowFilter;
    else name.style.filter=shadowFilter;
  }
  const text=paint.text;
  if(text){
    const targets=layerNodes.length?[name,...layerNodes]:[name];
    for(const target of targets){
      if(text.weight!==undefined)target.style.fontWeight=String(text.weight*100);
      if(text.variant)target.style.fontVariant=text.variant;
      if(text.transform)target.style.textTransform=text.transform;
      if(text.stroke){
        target.style.webkitTextStrokeWidth=text.stroke.width+'px';
        target.style.webkitTextStrokeColor=cssArgb(text.stroke.color);
      }
      if(text.shadows?.length){
        target.style.textShadow=text.shadows.slice(0,6).map(shadow=>
          shadow.xOffset+'px '+shadow.yOffset+'px '+shadow.radius+'px '+cssArgb(shadow.color)
        ).join(', ');
      }
    }
  }
}

export function createChatMessageElement(message: DisplayMessage, appearance: ChatAppearance = {}): HTMLElement {
  const root = document.createElement('div');
  root.className = 'overlay-chat-message';
  root.dataset.messageId = message.id;
  root.dataset.nameplate = appearance.nameplateStyle==='floating'?'floating':'inline';
  root.dataset.newLine=String(root.dataset.nameplate==='floating'||appearance.newLineAfterUsername!==false);
  const textAlign=appearance.textAlign==='center'||appearance.textAlign==='right'?appearance.textAlign:'left';
  root.dataset.textAlign=textAlign;
  root.style.textAlign=textAlign;
  root.style.fontSize = between(appearance.fontSize, 20, 8, 90) + 'px';
  const fallback=CHAT_FONT_STACKS[appearance.fontFamily ?? 'system'];
  const selected=normalizeGoogleFontFamily(appearance.googleFont);
  if(selected)loadGoogleFont(selected);
  root.style.fontFamily=selected ? JSON.stringify(selected)+', '+fallback : fallback;
  root.style.lineHeight = String(between(appearance.lineHeight, 1.45, 1, 2.5));
  const stroke = between(appearance.stroke, 0, 0, 4);
  if (stroke > 0) {
    // CSS text strokes are centered on the glyph edge. Paint the stroke first
    // and then repaint the fill over its inner half so the visible outline
    // grows outward without eating into counters or thin character strokes.
    root.style.webkitTextStrokeWidth = stroke * 2 + 'px';
    root.style.webkitTextStrokeColor = 'rgba(12, 15, 21, .8)';
    root.style.paintOrder = 'stroke fill';
  }
  root.style.textShadow = appearance.shadow === 'strong'
    ? '0 2px 8px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,.7)'
    : appearance.shadow === 'none' ? 'none'
    : '0 1px 4px rgba(0,0,0,.65)';
  // Text shadows are independent of bubble shadows. A transparent bubble
  // must never leave a visible rectangular box shadow behind the lettering.
  const alpha=between(appearance.backgroundAlpha,72,0,100);
  root.style.setProperty('--chat-bg-alpha',String(alpha/100));
  root.style.boxShadow = alpha === 0 && !appearance.background
    ? 'none' : '0 2px 14px rgba(0,0,0,.14)';
  root.style.borderRadius = between(appearance.radius, 12, 0, 40) + 'px';
  root.style.position='relative';
  root.dataset.enter = appearance.enter ?? 'rise';
  root.dataset.exit = appearance.exit ?? 'fade';
  root.style.setProperty('--chat-enter-duration', between(appearance.enterMs, 320, 120, 1200) + 'ms');
  const letterDuration = between(appearance.letterEnterMs ?? appearance.enterMs,320,120,1200);
  root.style.setProperty('--chat-letter-enter-duration', letterDuration+'ms');
  // Typewriter uses this control as typing cadence, rather than holding each
  // letter invisible for the full entrance duration before a rapid reveal.
  if (appearance.letterEnter === 'typewriter')
    root.style.setProperty('--letter-typing-step',typewriterStepMs(letterDuration)+'ms');
  root.style.setProperty('--chat-exit-duration', between(appearance.exitMs, 260, 100, 1000) + 'ms');
  if (appearance.textColor) root.style.color = appearance.textColor;
  const header = document.createElement('div');
  header.className = 'overlay-message-header';
  // Move the entire identity group, not just its text glyphs: right-aligned
  // usernames must carry the platform icon and badges to the same edge.
  header.style.justifyContent=textAlign==='left'?'flex-start':textAlign==='center'?'center':'flex-end';
  const usernameSize=between(appearance.usernameSize,0,0,64);
  if(root.dataset.nameplate==='floating'){
    // When a short message is narrower than its badge/nameplate, the old
    // 12px bubble padding left almost no top outline beyond the label.
    // Keep a modest visible arc beside the label without the previous
    // over-wide side gutters. Narrow sources still use compact CSS.
    const headerFont=usernameSize||between(appearance.fontSize,20,8,90);
    const cornerRadius=between(appearance.radius,12,0,40);
    const gutter=Math.max(16,Math.min(34,
      Math.round(6+cornerRadius*.5+headerFont*.32)));
    root.style.setProperty('--chat-nameplate-gutter',gutter+'px');
  }
  if(usernameSize>0){
    // All identity artwork (platform, source/chatter avatars, native role,
    // cosmetic and gift badges) uses em units. Set the shared header font
    // instead of only enlarging the name span, so every badge follows the
    // independent username size rather than the message body size.
    header.style.fontSize=usernameSize+'px';
    // Floating headers protrude above the bubble; reserve their overhang
    // using the header's actual scale, not the message text's font size.
    root.style.setProperty('--chat-nameplate-overhang',Number((usernameSize*.7).toFixed(2))+'px');
  }
  const body = document.createElement('div');
  body.className = 'overlay-message-body';
  root.append(header, body);
  header.style.position='relative';
  // Floating portraits have user-color shadow rings that extend beyond
  // the image box. A clipped header slices their bottom arcs off, especially
  // with smaller chat fonts and late badge updates.
  if(root.dataset.nameplate==='floating')header.style.overflow='visible';
  body.style.position='relative';
  body.style.textAlign=textAlign;
  header.style.zIndex=root.dataset.nameplate==='floating'?'3':'1';
  body.style.zIndex='1';
  setChatMessageBackground(root,message,appearance);
  if(appearance.background && (appearance.messageBackground??'theme')==='theme') root.style.background=appearance.background;
  const serviceBadge=appearance.showPlatformBadges===false?null:createServiceBadge(message.platform);
  if(serviceBadge){
    // The bubble corner slider spans 0..40; the square badge reaches a circle at 40.
    serviceBadge.style.borderRadius=(between(appearance.radius,12,0,40)/40*50)+'%';
    header.append(serviceBadge);
  }
  if (appearance.showBadges !== false) {
    const badgeContainer=document.createElement('span');
    badgeContainer.dataset.badgeContainer='true';
    header.append(badgeContainer);
    setChatBadgeImages(root,message.user.badges,appearance,message.user.color);
  }
  if (appearance.showNames !== false) {
    const name = document.createElement('strong');
    name.dataset.username = 'true';
    name.textContent = message.user.name;
    const color = safeColor(message.user.color);
    if (color) name.style.color = color;
    name.dataset.baseColor = name.style.color;
    const nameWrap=document.createElement('span');
    nameWrap.dataset.usernameWrap='true';
    nameWrap.style.display='inline-grid';
    nameWrap.style.verticalAlign='baseline';
    if(usernameSize>0)nameWrap.style.fontSize=usernameSize+'px';
    name.style.gridArea='1 / 1';
    nameWrap.append(name);
    const separator = document.createElement('span');
    separator.className = 'overlay-message-separator';
    separator.textContent = ': ';
    separator.hidden = root.dataset.newLine!=='false';
    header.append(nameWrap, separator);
    setChatNamePaint(root,message.user.namePaint);
  }
  syncChatHeaderOccupancy(header);
  const content = document.createElement('span');
  content.className = 'overlay-message-content';
  const mentionCount={value:0};
  const linkCount={value:0};
  for (const part of message.parts) {
    if (part.type === 'text')appendOverlayLinks(content,part.text,appearance,mentionCount,linkCount);
    else if(part.type === 'mention'){
      const span=createMentionElement({
        text:part.text,username:part.username??part.text.replace(/^@/u,''),
        userId:part.userId,
      },appearance,true);
      content.append(span);
      mentionCount.value++;
    } else if(part.type === 'media') {
      const src=safeImageUrl(part.url);
      if(!src) {
        content.append(document.createTextNode(part.text));
        continue;
      }
      const image=document.createElement('img');
      image.src=src;
      image.dataset.mediaType=part.mediaType;
      image.alt=part.alt ?? part.text;
      image.loading='lazy';
      image.style.maxWidth='min(240px,100%)';
      image.style.maxHeight='160px';
      image.style.objectFit='contain';
      content.append(image);
    } else {
      // text-bottom uses the whole font descent box. Custom script fonts can
      // leave far less visible ink beneath the baseline, making the image
      // hang low. A small font-relative baseline offset keeps its size intact.
      content.append(createEmoteArtwork(part.emote,between(appearance.emoteSize,36,12,160),'-0.12em'));
    }
  }
  body.append(content);
  setChatMessageTextColor(root,message,appearance);
  const letterEnter=appearance.letterEnter ?? 'none';
  const letterExit=appearance.letterExit ?? 'none';
  if(letterEnter!=='none' || letterExit!=='none') {
    const count=decorateChatLetters(content, letterEnter==='scramble' || letterEnter==='split-flap', letterEnter==='typewriter');
    if(count) {
      root.dataset.letterCount=String(count);
      root.dataset.letterEnter=letterEnter;
      root.dataset.letterExit=letterExit;
      root.style.setProperty('--letter-stagger',LETTER_STAGGER_MS+'ms');
    }
  }
  if (appearance.showTimestamp) {
    const time = document.createElement('time');
    time.textContent = new Date(message.timestamp).toLocaleTimeString();
    body.append(time);
  }
  return root;
}
