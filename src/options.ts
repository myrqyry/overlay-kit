/**
 * Single source of truth for the first Overlay Kit controls.
 * UI, presets, links, and renderer settings derive from this contract.
 * New options belong here only when a real consumer implements them.
 */
import { normalizeGoogleFontFamily } from './google-fonts';
import { EDGE_FADE_STYLES, EDGE_FADE_PATTERNS, type EdgeFadePattern, type EdgeFadeStyle, type EdgeFadeUnit } from './chat-edge-fade';
import type { ChatEntrance, ChatExit } from './chat-motion';
import type { ChatDeletionEffect } from './chat-deletion';
import type { WallEntrance, WallExit } from './wall-motion';
import { listChatStylePacks, type BuiltinChatStyle } from './style-packs';
import { listWallStylePacks, type BuiltinWallStyle } from './wall-style-packs';
import { WALL_COLOR_CHOICES,WALL_FINISH_CHOICES,type WallColor,type WallFinish } from './wall-aesthetics';
import { normalizeIgnoredUsers } from './admission';
import {serializeTriggerRules} from './overlay-triggers';
import type { EmojiService, WallEmojiService } from './emoji-service';
import { EVENT_ACCENTS, EVENT_FAMILIES, EVENT_ENTRANCES, EVENT_EXITS, EVENT_STYLES, parseEventOverrides, serializeEventOverrides, type EventAccent, type EventEntrance, type EventExit, type EventFamily, type EventStyle } from './event-overrides';

export type OptionSection = 'Chat • Capacity' | 'Chat • Artwork' | 'Chat • Content' | 'Chat • Badges' | 'Chat • Typography' |
  'Chat • Layout' | 'Chat • Styling' | 'Chat • Animations' | 'Chat • Triggers' | 'Wall • Capacity' | 'Wall • Artwork' | 'Wall • Content' | 'Wall • Movement' | 'Wall • Placement' | 'Wall • Triggers' | 'Avatars • Population' | 'Avatars • Content' | 'Avatars • Behavior' | 'Events • Presentation' | 'Events • Triggers';

export interface OverlayOptions {
  chatTriggerRules:string;
  wallTriggerRules:string;
  eventDuration:number;
  eventFont:number;
  eventPosition:'top'|'center'|'bottom';
  eventStyle:EventStyle;
  eventAccent:EventAccent;
  eventFamily:EventFamily;
  eventMotion:EventEntrance;
  eventMotionMs:number;
  eventExit:EventExit;
  eventExitMs:number;
  eventOverrides:string;
  eventSubs:boolean;
  eventFollows:boolean;
  eventRaids:boolean;
  eventCheers:boolean;
  avatarIgnoredUsers:string;
  avatarsMax: number;
  avatarSize: number;
  avatarActivity: 'calm' | 'playful';
  avatarNames: boolean;
  chatIgnoredUsers:string;
  max: number;
  ttl: number;
  size: number;
  wallMax: number;
  wallTtl: number;
  wallSize: number;
  wallEmojiService: WallEmojiService;
  wallGifs:boolean;
  wallIgnoredUsers:string;
  motion: 'still' | 'float' | 'bounce' | 'burst' | 'orbit' | 'sway' | 'flutter' | 'collide';
  wallEnter: WallEntrance;
  wallExit: WallExit;
  wallEnterMs: number;
  wallExitMs: number;
  wallField: 'none' | 'constellation';
  wallChorus: boolean;
  wallStyle: BuiltinWallStyle;
  wallColor: WallColor;
  wallFinish: WallFinish;
  font: number;
  usernameSize: number;
  textColorSource: 'theme' | 'user-color' | 'name-paint';
  fontFamily: 'system' | 'rounded' | 'mono' | 'serif';
  googleFont: string;
  chatEmojiService: EmojiService;
  showBadges: boolean;
  showPlatformBadges: boolean;
  showSourceBadges: boolean;
  showViewerBadges: boolean;
  showRoleBadges: boolean;
  showSubscriberBadges: boolean;
  showGifterBadges: boolean;
  showCosmeticBadges: boolean;
  showNames: boolean;
  showTimestamp: boolean;
  /** Presentation only: compact URL labels are not clickable in OBS. */
  linkDisplay:'compact'|'domain'|'hidden'|'full';
  align: 'left' | 'center' | 'right';
  textAlign: 'left' | 'center' | 'right';
  vertical: 'top' | 'bottom';
  chatLayout: 'stack' | 'strip' | 'spotlight';
  repeatMode: 'off' | 'count' | 'refresh' | 'bump';
  repeatMatch: 'exact' | 'normalized' | 'near';
  repeatScope: 'sender' | 'channel';
  repeatWindow: number;
  repeatShowCount: boolean;
  nameplateStyle: 'inline' | 'floating';
  newLineAfterUsername: boolean;
  /** Historical Horizontal Strip single/double choice, retained for migration. */
  stripRows: 'single' | 'double';
  chatStyle: BuiltinChatStyle;
  spacing: number;
  padding: number;
  /** A per-message pixel cap. Zero leaves the selected layout unchanged. */
  maxMessageWidth: number;
  /** Expand short bubbles to the positive width cap, within the layout. */
  uniformMessageWidth: boolean;
  lineHeight: number;
  backgroundAlpha: number;
  messageBackground: 'theme' | 'user-color' | 'name-paint';
  messagePaintBlur: number;
  messageOutline: number;
  radius: number;
  edgeFade: number;
  edgeFadeStyle: EdgeFadeStyle;
  edgeFadeUnit: EdgeFadeUnit;
  edgeFadePixels: number;
  edgeFadeOpacity: number;
  edgeFadeHold: number;
  edgeFadeSteps: number;
  edgeFadePattern: EdgeFadePattern;
  edgeFadePatternSize: number;
  stroke: number;
  shadow: 'none' | 'soft' | 'strong';
  enter: ChatEntrance;
  exit: ChatExit;
  enterMs: number;
  exitMs: number;
  deleteEffect: ChatDeletionEffect;
  deleteMs: number;
  letterEnter: 'none' | 'fade' | 'rise' | 'pop' | 'scramble' | 'slide' | 'drop' | 'flip' | 'twist' | 'wave' | 'spring' | 'drift' | 'soft-land' | 'typewriter' | 'split-flap' | 'stagger-fade' | 'blur-focus' | 'curtain-wipe' | 'glitch-split' | 'dissolve' | 'fold-collapse' | 'gravity-drop';
  letterEnterMs:number;
  letterExit: 'none' | 'fade' | 'sink' | 'scatter' | 'slide' | 'flip' | 'shrink' | 'twist';
  smoothReflow: boolean;
  reflowMs: number;
  wallSpeed: number;
  wallDistance: number;
  spawn: 'full' | 'top' | 'bottom' | 'edges';
}
export const OPTIONS_VERSION = 1 as const;
export const DEFAULT_OPTIONS: Readonly<OverlayOptions> = Object.freeze({
  chatTriggerRules:'',wallTriggerRules:'',
  eventDuration:6,eventFont:36,eventPosition:'center',eventStyle:'soft',eventAccent:'theme',eventFamily:'system',eventMotion:'rise',eventMotionMs:340,eventExit:'fade',eventExitMs:300,eventOverrides:'',
  eventSubs:true,eventFollows:true,eventRaids:true,eventCheers:true,
  avatarsMax: 24, avatarSize: 54, avatarActivity: 'playful', avatarNames: true, avatarIgnoredUsers:'',
  chatIgnoredUsers:'', max: 40, ttl: 15, size: 48, wallMax: 40, wallTtl: 15, wallSize: 48, wallIgnoredUsers:'',
  chatEmojiService:'system', wallEmojiService:'off', wallGifs:false, motion: 'float',
  font: 20, usernameSize:0, textColorSource:'theme', fontFamily: 'system', googleFont: '', showBadges: true,
  showPlatformBadges:true,showSourceBadges:true,showViewerBadges:true,showRoleBadges:true,
  showSubscriberBadges:true,showGifterBadges:true,showCosmeticBadges:true,showNames: true,
  showTimestamp: false, linkDisplay:'compact', align: 'left', textAlign:'left', vertical: 'bottom', chatLayout: 'stack', repeatMode:'off',repeatMatch:'exact',repeatScope:'sender',repeatWindow:15,repeatShowCount:true, nameplateStyle:'inline', newLineAfterUsername:true, stripRows: 'double', chatStyle: 'plain',
  spacing: 8, padding: 18, maxMessageWidth:0, uniformMessageWidth:false, lineHeight: 1.45,
  backgroundAlpha: 72, messageBackground:'theme', messagePaintBlur:0, messageOutline:0, radius: 12, edgeFade:0, edgeFadeStyle:'linear', edgeFadeUnit:'percent', edgeFadePixels:120, edgeFadeOpacity:0, edgeFadeHold:0, edgeFadeSteps:4, edgeFadePattern:'none', edgeFadePatternSize:6, stroke: 0, shadow: 'soft',
  enter: 'rise', exit: 'fade', enterMs: 320, exitMs: 260,
  deleteEffect: 'mixed', deleteMs: 350,
  letterEnter: 'none', letterEnterMs:320, letterExit: 'none',
  smoothReflow: false, reflowMs: 240,
  wallSpeed: 1, wallDistance: 24, spawn: 'full',
  wallEnter: 'none', wallExit: 'none', wallEnterMs: 340, wallExitMs: 260,
  wallField: 'none', wallChorus:false, wallStyle: 'original', wallColor:'original', wallFinish:'none',
});
type OptionKind = 'range' | 'toggle' | 'select' | 'font' | 'user-list' | 'overrides' | 'trigger-rules';
export interface OptionDefinition<K extends keyof OverlayOptions = keyof OverlayOptions> {
  key: K;
  query: string;
  section: OptionSection;
  label: string;
  hint: string;
  kind: OptionKind;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  choices?: readonly { value: string; label: string }[];
}
const choices = (...options: string[]) =>
  options.map(text => ({ value: text, label: text.replace(/-/g, ' ').replace(/^./, s => s.toUpperCase()) }));
export const OPTION_DEFINITIONS: readonly OptionDefinition[] = [
  {key:'eventDuration',query:'eventDuration',section:'Events • Presentation',kind:'range',label:'Alert duration',hint:'Seconds before the next notification starts.',min:1,max:30,step:1,unit:'s'},
  {key:'eventFont',query:'eventFont',section:'Events • Presentation',kind:'range',label:'Alert text size',hint:'Main notification text size in pixels.',min:16,max:80,step:1,unit:'px'},
  {key:'eventPosition',query:'eventPosition',section:'Events • Presentation',kind:'select',label:'Placement',hint:'Where notifications appear in the source.',choices:choices('top','center','bottom')},
  {key:'eventStyle',query:'eventStyle',section:'Events • Presentation',kind:'select',label:'Appearance',hint:'Background and typography treatment.',choices:choices(...EVENT_STYLES)},
  {key:'eventAccent',query:'eventAccent',section:'Events • Presentation',kind:'select',label:'Accent',hint:'Heading, rim and glow color, independent of the appearance and event type.',choices:choices(...EVENT_ACCENTS)},
  {key:'eventFamily',query:'eventFamily',section:'Events • Presentation',kind:'select',label:'Typeface',hint:'Font family for both the heading and message, independent of text size.',choices:choices(...EVENT_FAMILIES)},
  {key:'eventMotion',query:'eventMotion',section:'Events • Presentation',kind:'select',label:'Entrance',hint:'Optional one-shot arrival; no continuous animation loops.',choices:choices(...EVENT_ENTRANCES)},
  {key:'eventMotionMs',query:'eventMotionMs',section:'Events • Presentation',kind:'range',label:'Entrance duration',hint:'How long each alert takes to arrive. None skips the entrance.',min:100,max:1500,step:20,unit:'ms'},
  {key:'eventExit',query:'eventExit',section:'Events • Presentation',kind:'select',label:'Exit',hint:'Animate out after each alert expires, even with nothing queued.',choices:choices(...EVENT_EXITS)},
  {key:'eventExitMs',query:'eventExitMs',section:'Events • Presentation',kind:'range',label:'Exit duration',hint:'Time to animate away before the next alert.',min:100,max:1500,step:20,unit:'ms'},
  {key:'eventOverrides',query:'overrides',section:'Events • Presentation',kind:'overrides',label:'Type and tier overrides',hint:'Layer visual settings over the base Events settings for one event type, or for one provider tier such as Twitch 3, Prime, or a YouTube member level. The most specific matching rule wins; later rules win ties.'},
  {key:'chatTriggerRules',query:'chatTriggers',section:'Chat • Triggers',kind:'trigger-rules',label:'Commands and channel events',hint:'One rule per line: !hype -> confetti @mods 6s or raid -> spotlight 8s. Click Load examples for ready-made recipes. Commands require moderator/broadcaster by default; @any explicitly allows everyone.'},
  {key:'wallTriggerRules',query:'wallTriggers',section:'Wall • Triggers',kind:'trigger-rules',label:'Commands and channel events',hint:'One rule per line: !hype -> confetti @mods 6s or subscription -> holo-foil 8s. Click Load examples for ready-made recipes. Commands require moderator/broadcaster by default; @any explicitly allows everyone.'},
  {key:'eventSubs',query:'eventSubs',section:'Events • Triggers',kind:'toggle',label:'Subscriptions and gifts',hint:'New subscriptions and gift events when Chatbus receives them.'},
  {key:'eventFollows',query:'eventFollows',section:'Events • Triggers',kind:'toggle',label:'New follows',hint:'Requires Twitch authorization; anonymous chat alone cannot report follows.'},
  {key:'eventRaids',query:'eventRaids',section:'Events • Triggers',kind:'toggle',label:'Raids',hint:'Incoming raid signals from Chatbus.'},
  {key:'eventCheers',query:'eventCheers',section:'Events • Triggers',kind:'toggle',label:'Cheers and donations',hint:'Show bits and donation events that Chatbus actually delivers.'},
  { key:'avatarsMax', query:'avatarsMax', section:'Avatars • Population', kind:'range', label:'Maximum viewers', hint:'Characters persist per viewer, with a bounded population.', min:1, max:80, step:1 },
  { key:'avatarSize', query:'avatarSize', section:'Avatars • Population', kind:'range', label:'Character size', hint:'Pixel creature scale in the browser source.', min:18, max:110, step:1, unit:'px' },
  { key:'avatarNames', query:'avatarNames', section:'Avatars • Population', kind:'toggle', label:'Viewer names', hint:'Draw the viewer name beneath each character.' },
  { key:'avatarIgnoredUsers', query:'avatarIgnore', section:'Avatars • Content', kind:'user-list', label:'Ignored usernames', hint:'Comma-separated usernames that should never create an avatar.' },
  { key:'avatarActivity', query:'avatarActivity', section:'Avatars • Behavior', kind:'select', label:'Activity', hint:'Playful characters explore, greet, rest and hop more often. Calm mode slows them down.', choices:choices('calm','playful') },
  { key:'max', query:'max', section:'Chat • Capacity', kind:'range', label:'Maximum chat messages', hint:'Oldest chat messages leave when the cap is reached.', min:1, max:300, step:1 },
  { key:'ttl', query:'ttl', section:'Chat • Capacity', kind:'range', label:'Chat message lifetime', hint:'Seconds before chat expires a message.', min:1, max:600, step:1, unit:'s' },
  { key:'chatEmojiService', query:'emoji', section:'Chat • Artwork', kind:'select', label:'Emoji artwork service', hint:'System uses native emoji (Apple artwork on Apple devices). Google Noto, Twemoji and OpenMoji use hosted images; distinct from channel emotes.', choices:[{value:'system',label:'System emoji (native)'},{value:'noto',label:'Google Noto Color Emoji'},{value:'twemoji',label:'Twemoji'},{value:'openmoji',label:'OpenMoji'}] },
  { key:'size', query:'size', section:'Chat • Artwork', kind:'range', label:'Chat emote height', hint:'Height of emotes inside chat messages.', min:12, max:180, step:1, unit:'px' },
  { key:'wallGifs', query:'wallGifs', section:'Wall • Artwork',kind:'toggle',label:'Twitch subscriber GIFs',hint:'Optional: let Twitch GIPHY subscriber GIFs float on the wall as bounded image items. Off by default. Does not promote pasted GIF links or media from other providers.' },
  { key:'wallEmojiService', query:'wallEmoji', section:'Wall • Artwork', kind:'select', label:'Unicode emoji on wall', hint:'Add Unicode emoji from chat text alongside emotes. System uses the host native font (Apple artwork only on Apple devices). Off preserves current behavior.', choices:[{value:'off',label:'Off'},{value:'system',label:'System emoji (native)'},{value:'noto',label:'Google Noto Color Emoji'},{value:'twemoji',label:'Twemoji'},{value:'openmoji',label:'OpenMoji'}] },
  { key:'wallStyle', query:'wallStyle', section:'Wall • Artwork', kind:'select', label:'Material', hint:'Unmodified, cut paper, ink wash, or silhouette-masked holo foil. Combines with color and edge treatments.', choices:listWallStylePacks().map(pack=>({value:pack.id,label:pack.name})) },
  { key:'wallColor', query:'wallColor', section:'Wall • Artwork', kind:'select', label:'Color treatment', hint:'Color treatment independent of the material and motion.', choices:WALL_COLOR_CHOICES },
  { key:'wallFinish', query:'wallFinish', section:'Wall • Artwork', kind:'select', label:'Edge finish', hint:'A separate soft halo or tactile rim. Mix with material and color.', choices:WALL_FINISH_CHOICES },
  { key:'wallMax', query:'wallMax', section:'Wall • Capacity', kind:'range', label:'Maximum wall emotes', hint:'Independent wall limit, unaffected by chat.', min:1, max:300, step:1 },
  { key:'wallTtl', query:'wallTtl', section:'Wall • Capacity', kind:'range', label:'Wall emote lifetime', hint:'Independent wall lifetime in seconds.', min:1, max:600, step:1, unit:'s' },
  { key:'wallSize', query:'wallSize', section:'Wall • Artwork', kind:'range', label:'Wall emote height', hint:'Independent rendered emote height.', min:12, max:180, step:1, unit:'px' },
  { key:'wallIgnoredUsers', query:'wallIgnore', section:'Wall • Content', kind:'user-list', label:'Ignored usernames', hint:'Comma-separated usernames whose emotes should never enter the wall.' },

  { key:'showNames', query:'names', section:'Chat • Content', kind:'toggle', label:'Display usernames', hint:'Names can be hidden for minimal chat.' },
  { key:'showBadges', query:'badges', section:'Chat • Badges', kind:'toggle', label:'Display badges', hint:'Master switch for portraits, roles, gifts, and cosmetics. Platform icons have their own independent switch.' },
  { key:'showPlatformBadges', query:'platformBadges', section:'Chat • Badges', kind:'toggle', label:'Platform icons', hint:'Small Twitch, Kick, YouTube, or TikTok icon beside each message.' },
  { key:'showSourceBadges', query:'sourceBadges', section:'Chat • Badges', kind:'toggle', label:'Streamer profile pictures', hint:'Channel-owner portrait identifying the source of each message.' },
  { key:'showViewerBadges', query:'viewerBadges', section:'Chat • Badges', kind:'toggle', label:'Chatter profile pictures', hint:'Individual Twitch viewer portraits when an image is available.' },
  { key:'showRoleBadges', query:'roleBadges', section:'Chat • Badges', kind:'toggle', label:'Role badges', hint:'Moderator, VIP, verified, broadcaster, and other non-subscription roles.' },
  { key:'showSubscriberBadges', query:'subscriberBadges', section:'Chat • Badges', kind:'toggle', label:'Subscriber badges', hint:'Channel subscriptions and founder milestones.' },
  { key:'showGifterBadges', query:'gifterBadges', section:'Chat • Badges', kind:'toggle', label:'Gift badges', hint:'Subscription gifter counts and milestones.' },
  { key:'showCosmeticBadges', query:'cosmeticBadges', section:'Chat • Badges', kind:'toggle', label:'Cosmetic badges', hint:'7TV, BTTV, FFZ, and Kick collectible/level cosmetics.' },
  { key:'showTimestamp', query:'timestamps', section:'Chat • Content', kind:'toggle', label:'Timestamps', hint:'Show the original message time.' },
  { key:'linkDisplay', query:'links', section:'Chat • Content', kind:'select', label:'Link display',
    hint:'OBS viewers cannot click links. Compact shows the destination domain and short path without tracking query strings; Domain shows only the host; Hide shows a link marker; Full preserves every character. The actual URL stays in the DOM metadata.',
    choices:[{value:'compact',label:'Compact (domain + path)'},{value:'domain',label:'Domain only'},
      {value:'hidden',label:'Hide URL (link marker)'},{value:'full',label:'Full URL'}] },
  { key:'chatIgnoredUsers', query:'chatIgnore', section:'Chat • Content', kind:'user-list', label:'Ignored usernames', hint:'Comma-separated usernames whose messages should never appear.' },

  { key:'font', query:'font', section:'Chat • Typography', kind:'range', label:'Message text size', hint:'Message lettering in pixels; the existing font setting and OBS source link remain compatible.', min:9, max:64, step:1, unit:'px' },
  { key:'usernameSize', query:'usernameSize', section:'Chat • Typography', kind:'range', label:'Username size', hint:'Set independently in pixels. Zero keeps usernames matched to message text size, preserving old presets.', min:0, max:64, step:1, unit:'px' },
  { key:'textColorSource', query:'textColorSource', section:'Chat • Typography', kind:'select', label:'Message text color source', hint:'Theme keeps the style-pack color. User color follows the chatter; Name paint renders their safe 7TV paint colors/gradients with user-color fallback. Does not recolor usernames or emote images.', choices:[{value:'theme',label:'Theme'},{value:'user-color',label:'User color'},{value:'name-paint',label:'Name paint'}] },
  { key:'googleFont', query:'gfont', section:'Chat • Typography', kind:'font', label:'Google Font', hint:'Search the full Google Fonts catalog. Only the selected font is downloaded for the chat source.' },
  { key:'fontFamily', query:'family', section:'Chat • Typography', kind:'select', label:'Fallback typeface', hint:'Used when no Google Font is chosen or while it loads.', choices:choices('system','rounded','mono','serif') },
  { key:'lineHeight', query:'lineHeight', section:'Chat • Typography', kind:'range', label:'Line spacing', hint:'Vertical spacing within multiline messages.', min:1, max:2.5, step:0.05 },
  { key:'stroke', query:'stroke', section:'Chat • Typography', kind:'range', label:'Text outline', hint:'Increase readability over busy video.', min:0, max:4, step:0.5, unit:'px' },
  { key:'shadow', query:'shadow', section:'Chat • Typography', kind:'select', label:'Text shadow', hint:'Choose a subtle or strong text shadow.', choices:choices('none','soft','strong') },

  { key:'nameplateStyle', query:'nameplate', section:'Chat • Layout', kind:'select', label:'Username location', hint:'Inline keeps badges and username inside each bubble. Floating label places the same identity group across the bubble’s top border, like a field label; message text stays beneath it.', choices:[{value:'inline',label:'Inline'},{value:'floating',label:'Floating label'}] },
  { key:'newLineAfterUsername', query:'newLine', section:'Chat • Layout', kind:'toggle', label:'New line after username', hint:'On: badges and username above the message. Off: show badges, username and message together on the same flowing line. Only applies to Inline username location.' },
  { key:'chatLayout', query:'layout', section:'Chat • Layout', kind:'select', label:'Chat layout', hint:'Stack is classic vertical chat; Horizontal Strip lines up messages across the bottom; Latest Only is a single-message lower third.', choices:[{value:'stack',label:'Vertical Stack'},{value:'strip',label:'Horizontal Strip'},{value:'spotlight',label:'Latest Only'}] },
  { key:'repeatMode', query:'repeat', section:'Chat • Content', kind:'select', label:'Repeated messages', hint:'Compress repeated messages visually, without filtering the source. Counter stays in place; Refresh renews lifetime; Bump renews lifetime and moves the existing row to newest.', choices:[{value:'off',label:'Off'},{value:'count',label:'Counter'},{value:'refresh',label:'Refresh'},{value:'bump',label:'Bump to latest'}] },
  { key:'repeatMatch', query:'repeatMatch', section:'Chat • Content', kind:'select', label:'Repeat matching', hint:'Exact preserves capitalization. Normalized matches plain text case and spacing. Near additionally allows one edit in longer plain text. Emote and media identity remains exact.', choices:[{value:'exact',label:'Exact'},{value:'normalized',label:'Normalized'},{value:'near',label:'Near match'}] },
  { key:'repeatScope', query:'repeatScope', section:'Chat • Content', kind:'select', label:'Repeat participants', hint:'Same sender or everyone in the same source. Different sources are never merged.', choices:[{value:'sender',label:'Same sender'},{value:'channel',label:'Everyone in channel'}] },
  { key:'repeatWindow', query:'repeatWindow', section:'Chat • Content', kind:'range', label:'Repeat window', hint:'Seconds of inactivity before a new repeat group begins.', min:1,max:120,step:1,unit:'s' },
  { key:'repeatShowCount', query:'repeatCount', section:'Chat • Content', kind:'toggle', label:'Show repeat counter', hint:'Show the number of messages and, in collective mode, distinct chatters in the group.' },
  { key:'align', query:'align', section:'Chat • Layout', kind:'select', label:'Message alignment', hint:'Place the whole message bubble at the left, center, or right edge of the chat canvas. Independent of the text inside it.', choices:choices('left','center','right') },
  { key:'maxMessageWidth', query:'maxMessageWidth', section:'Chat • Layout', kind:'range', label:'Max message width', hint:'Cap the width of each message bubble in pixels. Zero uses the existing layout limit. Longer chat wraps instead of reducing text size; Horizontal Strip wraps when a cap is set.', min:0, max:1920, step:10, unit:'px' },
  { key:'uniformMessageWidth', query:'uniformMessageWidth', section:'Chat • Layout', kind:'toggle', label:'Uniform message width', hint:'Give every bubble the same width, using Max message width within the available canvas and layout limits. Set a positive maximum to activate; zero keeps natural sizing.' },
  { key:'textAlign', query:'textAlign', section:'Chat • Layout', kind:'select', label:'Text alignment', hint:'Align the username and its badges together with the message text inside each bubble. Independent of the message bubble position.', choices:choices('left','center','right') },
  { key:'vertical', query:'vertical', section:'Chat • Layout', kind:'select', label:'Vertical anchor', hint:'Top: latest message appears at the top, pushing older ones down. Bottom: latest appears at the bottom, pushing older ones up.', choices:choices('top','bottom') },
  { key:'spacing', query:'spacing', section:'Chat • Layout', kind:'range', label:'Between-message gap', hint:'Space between complete chat rows.', min:0, max:40, step:1, unit:'px' },
  { key:'padding', query:'padding', section:'Chat • Layout', kind:'range', label:'Canvas padding', hint:'Distance from screen edges.', min:0, max:90, step:1, unit:'px' },
  { key:'chatStyle', query:'style', section:'Chat • Styling', kind:'select', label:'Style pack', hint:'Changes chat appearance without changing message handling or your chosen layout.', choices:listChatStylePacks().filter(pack=>['plain','paper','phosphor'].includes(pack.id)).map(pack=>({value:pack.id,label:pack.name})) },
  { key:'messageBackground', query:'messageBg', section:'Chat • Styling', kind:'select', label:'Message background source', hint:'Theme uses the selected style pack; User color follows each chatter; Name paint reuses their sanitized Chatbus/7TV paint with safe fallbacks.', choices:[{value:'theme',label:'Theme'},{value:'user-color',label:'User color'},{value:'name-paint',label:'Name paint'}] },
  { key:'messagePaintBlur', query:'messagePaintBlur', section:'Chat • Styling', kind:'range', label:'Name paint background blur', hint:'Soften the 7TV paint inside the message bubble only. Text, badges, emotes, outlines and the scene behind the bubble remain sharp. Zero preserves the existing paint.', min:0, max:48, step:.5, unit:'px' },
  { key:'backgroundAlpha', query:'background', section:'Chat • Styling', kind:'range', label:'Message background opacity', hint:'Applies to theme, user-color, and name-paint bubble backgrounds.', min:0, max:100, step:1, unit:'%' },
  { key:'messageOutline', query:'messageOutline', section:'Chat • Styling', kind:'range', label:'Message outline', hint:'Outline thickness (0 disables). A 7TV paint colors the rounded outline with its gradients and layers, independently of bubble background; otherwise uses the selected background color.', min:0, max:8, step:0.5, unit:'px' },
  { key:'radius', query:'radius', section:'Chat • Styling', kind:'range', label:'Bubble corners', hint:'Rounded versus square message backgrounds.', min:0, max:40, step:1, unit:'px' },
  { key:'edgeFadeStyle', query:'edgeFadeStyle', section:'Chat • Styling', kind:'select', label:'Exit edge fade style', hint:'Choose the spatial fade profile. Automatically follows the side older chat leaves from; separate from message exit animation.', choices:EDGE_FADE_STYLES.map(choice=>({...choice})) },
  { key:'edgeFadeUnit', query:'edgeFadeUnit', section:'Chat • Styling', kind:'select', label:'Exit edge fade units', hint:'Relative distance adapts to canvas size; pixel distance stays fixed up to the size of the canvas.', choices:[{value:'percent',label:'Percent of canvas'},{value:'pixels',label:'Pixels'}] },
  { key:'edgeFade', query:'edgeFade', section:'Chat • Styling', kind:'range', label:'Exit edge fade', hint:'Fade distance as a percentage of the canvas along the exit direction. Zero disables the mask.', min:0, max:40, step:1, unit:'%' },
  { key:'edgeFadePixels', query:'edgeFadePixels', section:'Chat • Styling', kind:'range', label:'Exit edge fade distance', hint:'Fixed fade distance in pixels. Zero disables the mask; a narrow canvas clamps the full distance.', min:0, max:1200, step:10, unit:'px' },
  { key:'edgeFadeOpacity', query:'edgeFadeOpacity', section:'Chat • Styling', kind:'range', label:'Exit edge opacity', hint:'How visible chat remains at the departing edge. Zero is transparent; 100 leaves all chat visible.', min:0, max:100, step:1, unit:'%' },
  { key:'edgeFadeHold', query:'edgeFadeHold', section:'Chat • Styling', kind:'range', label:'Exit edge fade hold', hint:'Keep the edge opacity constant across this fraction of the fade distance before recovering to full opacity.', min:0, max:90, step:1, unit:'%' },
  { key:'edgeFadeSteps', query:'edgeFadeSteps', section:'Chat • Styling', kind:'range', label:'Exit edge fade steps', hint:'Number of discrete opacity bands in Terraced mode.', min:2, max:12, step:1 },
  { key:'edgeFadePattern', query:'edgeFadePattern', section:'Chat • Styling', kind:'select', label:'Exit edge texture', hint:'Break up the departing edge with transparent pixels, scattered grain or a torn-paper contour. Combine with the fade profile, or set edge opacity to 100% for the texture alone. Requires a positive fade distance.', choices:EDGE_FADE_PATTERNS.map(choice=>({...choice})) },
  { key:'edgeFadePatternSize', query:'edgeFadePatternSize', section:'Chat • Styling', kind:'range', label:'Exit edge texture scale', hint:'Pattern spacing across the edge, in pixels. Pattern depth stretches with the fade distance.', min:2, max:24, step:1, unit:'px' },
  { key:'enter', query:'enter', section:'Chat • Animations', kind:'select', label:'Message entrance', hint:'Compositor-only transforms and opacity; never animates row size.', choices:choices('none','rise','slide','slide-right','drop','scale','pop','flip','drift','unfurl','soft-land','wave','twist','blur-focus','curtain-wipe','glitch-split','dissolve','split-flap','fold-collapse') },
  { key:'enterMs', query:'enterMs', section:'Chat • Animations', kind:'range', label:'Entrance duration', hint:'How long each new message animates.', min:120, max:1200, step:20, unit:'ms' },
  { key:'exit', query:'exit', section:'Chat • Animations', kind:'select', label:'Message exit', hint:'Natural lifetime expiry only; deleted chat is removed immediately.', choices:choices('none','fade','slide-left','slide-right','sink','shrink','flip','float-away','tuck','wave','twist','spring','blur-out','curtain-close','glitch-split','dissolve','split-flap','fold-collapse') },
  { key:'exitMs', query:'exitMs', section:'Chat • Animations', kind:'range', label:'Exit duration', hint:'Keeps its normal layout slot during the exit; releases it afterward.', min:100, max:1000, step:20, unit:'ms' },
  { key:'deleteEffect', query:'deleteEffect', section:'Chat • Animations', kind:'select', label:'Deleted message effect', hint:'Scribble or crumple the empty afterimage; original content is removed immediately.', choices:choices('mixed','scribble','crumple','none') },
  { key:'deleteMs', query:'deleteMs', section:'Chat • Animations', kind:'range', label:'Deletion duration', hint:'Short animation on the content-free afterimage only.', min:120, max:700, step:10, unit:'ms' },
  { key:'letterEnter', query:'letterEnter', section:'Chat • Animations', kind:'select', label:'Letter entrance', hint:'Optional staggered grapheme entrance within the message bubble. Both letter and message entrances can animate together.', choices:choices('none','fade','rise','pop','scramble','slide','drop','flip','twist','wave','spring','drift','soft-land','typewriter','split-flap','stagger-fade','blur-focus','curtain-wipe','glitch-split','dissolve','fold-collapse','gravity-drop') },
  { key:'letterEnterMs', query:'letterEnterMs', section:'Chat • Animations', kind:'range', label:'Letter entrance duration', hint:'Duration per animated letter, independent of the whole-message entrance. Letters still stagger after one another.', min:120,max:1200,step:20,unit:'ms' },
  { key:'letterExit', query:'letterExit', section:'Chat • Animations', kind:'select', label:'Letter exit', hint:'Optional staggered grapheme exit for natural expiry, not moderation deletion.', choices:choices('none','fade','sink','scatter','slide','flip','shrink','twist') },
  { key:'smoothReflow', query:'smoothReflow', section:'Chat • Animations', kind:'toggle', label:'Smooth message movement', hint:'Glide existing rows after insertions or removals. Batched once per frame, not layout animation.' },
  { key:'reflowMs', query:'reflowMs', section:'Chat • Animations', kind:'range', label:'Movement duration', hint:'Duration of existing-row movement when smooth movement is enabled.', min:100, max:1000, step:20, unit:'ms' },

  { key:'motion', query:'motion', section:'Wall • Movement', kind:'select', label:'Motion path', hint:'Movement path independent of entrance and exit. Collision makes emotes rebound from each other and the canvas edges; Burst is a one-shot motion.', choices:[...choices('still','float','bounce','burst','orbit','sway','flutter'),{value:'collide',label:'Collision'}] },
  { key:'wallSpeed', query:'speed', section:'Wall • Movement', kind:'range', label:'Motion speed', hint:'Multiplier for the selected path.', min:0.25, max:4, step:0.05, unit:'×' },
  { key:'wallDistance', query:'distance', section:'Wall • Movement', kind:'range', label:'Travel distance', hint:'Travel range for the looping paths; Collision uses speed instead.', min:0, max:160, step:1, unit:'px' },
  { key:'wallEnter', query:'wallEnter', section:'Wall • Movement', kind:'select', label:'Emote entrance', hint:'How artwork appears, independently of ongoing movement.', choices:choices('none','fade','pop','drop','slide','spin','unfurl','spring','echo-print','impact','assemble','comet','color-bloom','prism-reveal','pigment-wash','blur-focus','curtain-wipe','glitch-split','dissolve','split-flap','fold-collapse') },
  { key:'wallEnterMs', query:'wallEnterMs', section:'Wall • Movement', kind:'range', label:'Entrance duration', hint:'Time for each emote to appear.', min:100, max:1500, step:20, unit:'ms' },
  { key:'wallExit', query:'wallExit', section:'Wall • Movement', kind:'select', label:'Emote exit', hint:'How emotes disappear on natural expiry; moderation remains immediate.', choices:choices('none','fade','shrink','drift','sink','spin','lift','tumble','flip','spring','shatter','vortex','fold-away','color-drain','prism-dissolve','afterglow','blur-out','curtain-close','glitch-split','dissolve','split-flap','fold-collapse') },
  { key:'wallExitMs', query:'wallExitMs', section:'Wall • Movement', kind:'range', label:'Exit duration', hint:'Time before expired artwork is detached.', min:100, max:1500, step:20, unit:'ms' },
  { key:'wallField', query:'wallField', section:'Wall • Movement', kind:'select', label:'Interactive field', hint:'Constellation connects emotes with living filaments; replaces the individual looping motion while active.', choices:choices('none','constellation') },
  { key:'wallChorus', query:'chorus', section:'Wall • Movement', kind:'toggle', label:'Emote chorus reactions', hint:'Opt-in: when 3 different chatters send the same emote within 8 seconds, add up to 6 extra copies. Cooldown and moderation apply.' },
  { key:'spawn', query:'spawn', section:'Wall • Placement', kind:'select', label:'Spawn region', hint:'Distribute emotes across the screen or near an edge.', choices:choices('full','top','bottom','edges') },
] as const;

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
function parseBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === 'true' || value === '1') return true;
  if (value === false || value === 0 || value === 'false' || value === '0') return false;
  return undefined;
}
export function normalizeOptions(input: unknown): OverlayOptions {
  if (isObject(input) && 'version' in input && input.version !== OPTIONS_VERSION) {
    throw new Error('Unsupported overlay preset version');
  }
  const data = isObject(input) && isObject(input.settings) ? input.settings : isObject(input) ? input : {};
  const result: Record<string, string | boolean | number> = { ...DEFAULT_OPTIONS };
  for (const def of OPTION_DEFINITIONS) {
    const value = data[def.key];
    if (value === undefined || value === null) continue;
    if (def.kind === 'font') {
      result[def.key]=normalizeGoogleFontFamily(value);
    } else if (def.kind === 'user-list') {
      result[def.key]=normalizeIgnoredUsers(value);
    } else if (def.kind === 'overrides') {
      result[def.key] = serializeEventOverrides(parseEventOverrides(value));
    } else if(def.kind==='trigger-rules'){
      result[def.key]=serializeTriggerRules(value,def.key==='chatTriggerRules'?'chat':'wall');
    } else if (def.kind === 'toggle') {
      const parsed = parseBoolean(value);
      if (parsed !== undefined) result[def.key] = parsed;
    } else if (def.kind === 'range') {
      const parsed = typeof value === 'number' ? value :
        typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
      if (!Number.isFinite(parsed)) continue;
      const limited = Math.min(def.max!, Math.max(def.min!, parsed));
      const step = def.step ?? 1;
      const snapped = Math.round(limited / step) * step;
      result[def.key] = Number(snapped.toFixed(5));
    } else if (typeof value === 'string' && def.choices?.some(choice => choice.value === value)) {
      result[def.key] = value;
    }
  }
  // Restore the retired Horizontal Strip single-row preference in old saved
  // presets. An explicit new toggle always wins over the legacy field.
  if(!Object.hasOwn(data,'newLineAfterUsername') && data.stripRows==='single')
    result.newLineAfterUsername=false;
  // Previous versions used the message entrance duration for the letter
  // entrance as well. Carry that value forward when importing an old OBS
  // link/preset, so selecting a separate duration does not silently speed
  // up (or slow down) a previously configured letter entrance.
  if(!Object.hasOwn(data,'letterEnterMs'))result.letterEnterMs=result.enterMs!;
  return result as unknown as OverlayOptions;
}
export function readOptions(search: string, view?: OverlayEditorView): OverlayOptions {
  const params = new URLSearchParams(search);
  const found: Record<string, string> = {};
  for (const def of OPTION_DEFINITIONS) {
    if (view && !def.section.startsWith(viewSection(view))) continue;
    const value = params.get(def.query);
    if (value !== null) found[def.key] = value;
  }
  // Historical Horizontal Strip links had ?rows=single|double before the
  // per-chat line-break setting was retired. Preserve their intended flow.
  if((!view || view==='chat') && !params.has('newLine')){
    if(params.get('rows')==='single')found.newLineAfterUsername='false';
    if(params.get('rows')==='double')found.newLineAfterUsername='true';
  }
  // Support older Wall URLs, whose capacity values used to be shared with Chat.
  if (view === 'wall') {
    for (const [oldKey,newKey] of [['max','wallMax'],['ttl','wallTtl'],['size','wallSize']] as const) {
      if (!params.has(newKey) && params.has(oldKey)) found[newKey] = params.get(oldKey)!;
    }
  }
  return normalizeOptions(found);
}
export function writeOptions(settings: OverlayOptions, view?: OverlayEditorView): string {
  const clean = normalizeOptions(settings);
  const params = new URLSearchParams();
  for (const def of OPTION_DEFINITIONS) {
    if (view && !def.section.startsWith(viewSection(view))) continue;
    const value = clean[def.key];
    // Old chat links treated enterMs as the letter timing whenever a
    // letter-specific value was absent. Encode an explicit default letter
    // duration when it differs from a customized message entrance so that
    // saving a new independent choice round-trips without legacy inference.
    const disambiguateLetterTiming=def.key==='letterEnterMs'
      && clean.letterEnterMs!==clean.enterMs
      && clean.enterMs!==DEFAULT_OPTIONS.enterMs;
    if (value !== DEFAULT_OPTIONS[def.key] || disambiguateLetterTiming)
      params.set(def.query, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return params.toString();
}
export type OverlayEditorView = 'wall' | 'chat' | 'avatars' | 'events';
const viewSection=(view:OverlayEditorView) => view==='chat'?'Chat •':view==='wall'?'Wall •':view==='avatars'?'Avatars •':'Events •';
/** Reusable panel scope: every option belongs to exactly one overlay.
 * All settings are visible by default; search only narrows within the selected editor.
 * The legacy boolean argument is intentionally ignored so older callers remain compatible. */
export function optionsForEditor(view: OverlayEditorView, _legacyAdvanced: boolean, query = ''): OptionDefinition[] {
  const term = query.trim().toLocaleLowerCase();
  return OPTION_DEFINITIONS.filter(def => {
    const own = def.section.startsWith(viewSection(view));
    const matching = !term ||
      (def.section + ' ' + def.label + ' ' + def.hint).toLocaleLowerCase().includes(term);
    return own && matching;
  });
}

/** Editor visibility only; hidden controls remain in saved presets and OBS
 * links so switching between Inline and Floating never discards a choice. */
export function isOptionApplicable(
  key:keyof OverlayOptions,
  settings:Pick<OverlayOptions,
    'nameplateStyle'|'messageBackground'|'enter'|'letterEnter'|'smoothReflow'> &
    Partial<Pick<OverlayOptions,'chatLayout'|'edgeFadeUnit'|'edgeFadeStyle'|'edgeFadePattern'|'eventMotion'>>,
):boolean {
  if(key.startsWith('edgeFade')){
    if(settings.chatLayout==='spotlight')return false;
    if(key==='edgeFade')return settings.edgeFadeUnit!=='pixels';
    if(key==='edgeFadePixels')return settings.edgeFadeUnit==='pixels';
    if(key==='edgeFadePatternSize')return !!settings.edgeFadePattern&&settings.edgeFadePattern!=='none';
    if(key==='edgeFadeSteps')return settings.edgeFadeStyle==='steps';
    if(key==='edgeFadeHold')return settings.edgeFadeStyle!=='cut';
  }
  if(key==='newLineAfterUsername')return settings.nameplateStyle!=='floating';
  if(key==='messagePaintBlur')return settings.messageBackground==='name-paint';
  if(key==='enterMs')return settings.enter!=='none';
  if(key==='letterEnterMs')return settings.letterEnter!=='none';
  if(key==='eventMotionMs')return settings.eventMotion!=='none';
  if(key==='reflowMs')return settings.smoothReflow;
  return true;
}

/** Shipped styles are full typed settings; custom files use {version,settings}. */
export const PRESETS: Readonly<Record<'classic'|'minimal'|'expressive', OverlayOptions>> = {
  classic: normalizeOptions(DEFAULT_OPTIONS),
  minimal: normalizeOptions({ ...DEFAULT_OPTIONS, font: 23, backgroundAlpha: 0, shadow:'strong',
    radius:0, spacing:3, showBadges:false, enter:'none', exit:'none', wallSpeed:0.7, motion:'float' }),
  expressive: normalizeOptions({ ...DEFAULT_OPTIONS, fontFamily:'rounded', font:24, backgroundAlpha:85,
    stroke:0.5, radius:20, enter:'pop', exit:'shrink', size:65, wallSize:65,
    motion:'bounce', wallSpeed:1.4, wallDistance:55,
    showTimestamp:true }),
};
