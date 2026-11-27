import {kickRoleArtworkKey,sanitizeKickRoleBody} from '@myrqyry/chatbus/kick-artwork';
import type { NamePaint } from '@myrqyry/chatbus';
import {bestBadgeImageUrl} from './badge-images';
/** Structural Chatbus input. No transport, network or Chatbus runtime import. */
export interface ProviderEmote {
  id: string;
  code: string;
  url: string;
  modifierFlags?: number;
  provider?:string;
  animated?:boolean;
  content?: {sexual?:boolean;epilepsy?:boolean;edgy?:boolean};
}
export interface ChatbusFragment {
  type: string;
  text: string;
  emote?: ProviderEmote;
  overlays?: readonly ProviderEmote[];
  modifiers?: readonly ProviderEmote[];
  username?:string;
  userId?:string;
  url?:string;
  alt?:string;
  mediaType?:'gif'|'image';
  bits?:number;
}
export interface ChatbusMessage {
  id: string;
  timestamp: number;
  user: {
    id?: string;
    username: string;
    displayName?: string;
    color?: string;
    roles?: readonly string[];
    namePaint?: NamePaint;
    badges?: readonly {
      id: string; provider?: string; tooltip?: string; name?: string; title?: string; url?: string;
      version?:string; svgBody?:string;
      images?: readonly { url: string; width?: number; scale?:number }[];
    }[];
    badgeRefs?: readonly {id:string;provider?:string;version?:string;info?:string}[];
  };
  platform?: string;
  channelName?: string;
  traits?: { highlighted?: boolean; firstMessage?: boolean; emoteOnly?: boolean; messageType?: string; customRewardId?: string };
  reply?: { parentUsername?: string; parentDisplayName?: string; parentMessageId?: string; parentMessageBody?: string };
  fragments: readonly ChatbusFragment[];
}
export interface EmoteArtwork {
  id: string;
  code: string;
  url: string;
  overlays: { code: string; url: string; flags?: number }[];
  modifiers: { code: string; flags: number }[];
  provider?:string;animated?:boolean;
  /** Presentation-only Unicode emoji; never assigned by Chatbus emote normalization. */
  emojiService?: 'system' | 'twemoji' | 'openmoji' | 'noto';
  content?:ProviderEmote['content'];
}
export type MessagePart =
  | {type:'text';text:string}
  | {type:'emote';emote:EmoteArtwork;bits?:number}
  | {type:'mention';text:string;username?:string;userId?:string}
  | {type:'media';text:string;mediaType:'gif'|'image';url:string;alt?:string};
export interface DisplayPaintGradient {
  function: 'LINEAR_GRADIENT' | 'RADIAL_GRADIENT' | 'URL';
  angle?: number;
  shape?: 'circle' | 'ellipse';
  repeat?: boolean;
  at?: [number, number];
  canvasSize?: [number, number];
  canvasRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y' | 'round' | 'space';
  imageUrl?: string;
  stops: { at: number; color: number }[];
}
export interface DisplayPaintShadow {
  xOffset: number; yOffset: number; radius: number; color: number;
}
export type DisplayPaintLayer =
  | {kind:'solid'; color:number; opacity:number}
  | {kind:'linear'; angle:number; repeating:boolean; stops:{at:number;color:number}[]; opacity:number}
  | {kind:'radial'; shape:'circle'|'ellipse'; repeating:boolean; stops:{at:number;color:number}[]; opacity:number}
  | {kind:'image'; url:string; opacity:number};
export interface DisplayNamePaint {
  id: string; provider: '7tv' | 'custom'; color?: number;
  gradients?: DisplayPaintGradient[];
  layers?: DisplayPaintLayer[];
  shadows?: DisplayPaintShadow[];
  text?: {
    weight?: number;
    transform?: 'uppercase' | 'lowercase';
    variant?: 'normal' | 'small-caps';
    stroke?: {width: number; color: number};
    shadows?: DisplayPaintShadow[];
  };
}
/** 7TV v3 encodes ARGB as *signed* int32. Do not reject negative numbers. */
const paintArgb=(value:unknown):number|undefined=>
  typeof value==='number' && Number.isInteger(value) &&
  value>=-0x80000000 && value<=0xffffffff ? value>>>0 : undefined;
const paintPair=(value:unknown):[number,number]|undefined=>
  Array.isArray(value) && value.length===2 &&
  value.every((v:unknown)=>typeof v==='number' && Number.isFinite(v))
  ? [Math.max(0,Math.min(1,value[0] as number)),
     Math.max(0,Math.min(1,value[1] as number))] : undefined;
const paintShadows=(shadows:NamePaint['shadows']):DisplayPaintShadow[]=>
  (shadows??[]).slice(0,6).flatMap(s=>{
    const color=paintArgb(s.color);
    if(color===undefined || ![s.xOffset,s.yOffset,s.radius].every(Number.isFinite))return [];
    return [{xOffset:Math.max(-40,Math.min(40,s.xOffset)),
      yOffset:Math.max(-40,Math.min(40,s.yOffset)),
      radius:Math.max(0,Math.min(40,s.radius)),color}];
  });
/** Only HTTPS image paint sources, never provider-authored arbitrary CSS. */
const paintImageUrl=(value:unknown):string|undefined=>{
  if(typeof value!=='string'||value.length>2048)return undefined;
  try {
    const url=new URL(value);
    return url.protocol==='https:'?url.href:undefined;
  } catch {return undefined;}
};
export function projectNamePaint(paint:NamePaint|undefined):DisplayNamePaint|undefined {
  if(!paint || !paint.id || (paint.provider!=='7tv' && paint.provider!=='custom'))return undefined;
  const projectStops=(stops:readonly {at:number;color:number}[]|undefined)=>
    (stops??[]).slice(0,32).flatMap(stop=>{
      const color=paintArgb(stop.color);
      return color===undefined||!Number.isFinite(stop.at)?[]:
        [{at:Math.max(-5,Math.min(5,stop.at)),color}];
    });
  const projectLayer=(layer:NonNullable<NamePaint['layers']>[number]):DisplayPaintLayer[]=>{
    const opacity=Number.isFinite(layer.opacity)?Math.max(0,Math.min(1,layer.opacity)):1;
    if(layer.kind==='solid'){
      const color=paintArgb(layer.color);
      return color===undefined?[]:[{kind:'solid',color,opacity}];
    }
    if(layer.kind==='image'){
      const url=paintImageUrl(layer.url);
      return url?[{kind:'image',url,opacity}]:[];
    }
    const stops=projectStops(layer.stops);
    if(stops.length<2)return [];
    if(layer.kind==='linear')return [{kind:'linear',
      angle:Number.isFinite(layer.angle)?Math.max(-3600,Math.min(3600,layer.angle)):0,
      repeating:layer.repeating===true,stops,opacity}];
    if(layer.kind==='radial')return [{kind:'radial',
      shape:layer.shape==='circle'?'circle':'ellipse',
      repeating:layer.repeating===true,stops,opacity}];
    return [];
  };
  const projectGradient=(g:NonNullable<NamePaint['gradients']>[number]):DisplayPaintGradient[]=>{
    const fn=g.function??'LINEAR_GRADIENT';
    if(fn!=='LINEAR_GRADIENT'&&fn!=='RADIAL_GRADIENT'&&fn!=='URL')return [];
    const imageUrl=fn==='URL'?paintImageUrl(g.imageUrl):undefined;
    const stops=fn==='URL'?[]:(g.stops??[]).slice(0,20).flatMap(stop=>{
      const color=paintArgb(stop.color);
      return color===undefined||!Number.isFinite(stop.at)?[]:
        [{at:Math.max(-5,Math.min(5,stop.at)),color}];
    });
    if(fn==='URL'?!imageUrl:stops.length<2)return [];
    const shape=g.shape?.toLowerCase();
    const canvasRepeat=g.canvasRepeat;
    const repeatOptions=['no-repeat','repeat','repeat-x','repeat-y','round','space'];
    return [{function:fn,stops,
      ...(typeof g.angle==='number'&&Number.isFinite(g.angle)?{angle:Math.max(-3600,Math.min(3600,g.angle))}:{}),
      ...(shape==='circle'||shape==='ellipse'?{shape}:{}),
      ...(typeof g.repeat==='boolean'?{repeat:g.repeat}:{}),
      ...(paintPair(g.at)?{at:paintPair(g.at)}:{}),
      ...(paintPair(g.canvasSize)?{canvasSize:paintPair(g.canvasSize)}:{}),
      ...(repeatOptions.includes(canvasRepeat??'')?{canvasRepeat:canvasRepeat as DisplayPaintGradient['canvasRepeat']}:{}),
      ...(imageUrl?{imageUrl}:{})}];
  };
  // 7TV's live v3 cosmetics return legacy top-level stops with gradients: [].
  const gradients=(paint.gradients??[]).slice(0,5).flatMap(projectGradient);
  if(!gradients.length && paint.function) {
    gradients.push(...projectGradient({
      function:paint.function,angle:paint.angle,shape:paint.shape,repeat:paint.repeat,
      imageUrl:paint.imageUrl,stops:paint.stops??[],
    }));
  }
  const layers=(paint.layers??[]).slice(0,12).flatMap(projectLayer);
  const text=paint.text;
  const weight=text?.weight;
  const stroke=text?.stroke;
  const projectedText=text?{
    ...(typeof weight==='number'&&Number.isInteger(weight)&&weight>=1&&weight<=9?{weight}:{}),
    ...(text.transform==='uppercase'||text.transform==='lowercase'
      ?{transform:text.transform as 'uppercase'|'lowercase'}:{}),
    ...(text.variant==='normal'||text.variant==='small-caps'
      ?{variant:text.variant as 'normal'|'small-caps'}:{}),
    ...(stroke && Number.isFinite(stroke.width) && paintArgb(stroke.color)!==undefined
      ? {stroke:{width:Math.max(0,Math.min(8,stroke.width)),color:paintArgb(stroke.color)!}}:{}),
    ...(text.shadows?.length?{shadows:paintShadows(text.shadows)}:{}),
  }:undefined;
  const color=paintArgb(paint.color);
  return {id:paint.id,provider:paint.provider,
    ...(color!==undefined?{color}:{}),
    ...(gradients.length?{gradients}:{}),
    ...(layers.length?{layers}:{}),
    ...(paint.shadows?.length?{shadows:paintShadows(paint.shadows)}:{}),
    ...(projectedText?{text:projectedText}:{})
  };
}

export interface DisplayBadge {
  name:string;url?:string;text?:string;provider?:string;id?:string;tooltip?:string;
  /** Validated runtime design-system artwork for a semantic Kick role. */
  kickRoleSvg?:string;
  /** Owning *source* user's chat color, never inferred from a message author. */
  color?:string;
}
export interface DisplayMessage {
  id: string;
  timestamp: number;
  user: {
    name: string; id?: string; username?: string; color?: string;
    roles?:string[]; namePaint?:DisplayNamePaint;
    badges: DisplayBadge[];
  };
  parts: MessagePart[];
  platform?:string;
  channelName?:string;
  /** Stable owning connection identity when several Chatbus sources are mixed. */
  sourceId?:string;
  traits?:ChatbusMessage['traits'];
  reply?:ChatbusMessage['reply'];
}
const kickFallbackBadge=(ref:{id:string;provider?:string;version?:string;info?:string}):DisplayBadge|undefined=>{
  if(ref.provider!=='kick')return undefined;
  const id=ref.id.toLowerCase();
  const count=ref.version && /^[1-9]\d{0,5}$/.test(ref.version)?ref.version:undefined;
  // Text fallback labels are presentation-only; Chatbus owns provider artwork.
  if(id==='moderator')return {provider:'kick',id,name:'Moderator',text:'MOD'};
  if(id==='verified')return {provider:'kick',id,name:'Verified',text:'VERIFIED'};
  if(id==='subscriber')return {provider:'kick',id:'subscriber',name:ref.info||'Subscriber',text:'SUB'+(count?' '+count:'')};
  if(id==='sub_gifter')return {provider:'kick',id:'sub_gifter',name:ref.info||'Sub Gifter',text:'GIFT'+(count?' '+count:'')};
  return undefined;
};
export function projectDisplayBadges(
  badges:readonly NonNullable<ChatbusMessage['user']['badges']>[number][]=[],
  refs:readonly NonNullable<ChatbusMessage['user']['badgeRefs']>[number][]=[],
):DisplayBadge[]{
  const projected:DisplayBadge[]=badges.flatMap(badge=>{
    const url=badge.url??bestBadgeImageUrl(badge.images);
    return url?[{name:badge.name??badge.title??badge.id,url,
      ...(badge.provider?{provider:badge.provider}:{}),...(badge.id?{id:badge.id}:{}),
      ...(badge.tooltip?{tooltip:badge.tooltip}:{})}]:[];
  });
  const represented=new Set(projected.map(badge=>(badge.provider??'')+':'+(badge.id??'').toLowerCase()));
  const vectors=new Map(badges.flatMap(badge=>{
    const key=kickRoleArtworkKey(badge);
    const body=key?sanitizeKickRoleBody(badge.svgBody):undefined;
    return key&&body?[[key,body] as const]:[];
  }));
  // Preserve legacy role order and text fallbacks, including the exact gifting
  // count. Native URLs have already claimed their identities above.
  const appendFallback=(ref:{id:string;provider?:string;version?:string;info?:string})=>{
    const fallback=kickFallbackBadge(ref);if(!fallback)return;
    const key=(fallback.provider??'')+':'+(fallback.id??'').toLowerCase();
    if(represented.has(key))return;
    const role=kickRoleArtworkKey(ref),kickRoleSvg=role?vectors.get(role):undefined;
    represented.add(key);projected.push(kickRoleSvg?{...fallback,kickRoleSvg}:fallback);
  };
  for(const ref of refs)appendFallback(ref);
  // Also accept standalone normalized vector badge records from other
  // Chatbus consumers, when their original semantic refs aren't provided.
  for(const badge of badges){
    const role=kickRoleArtworkKey(badge);
    if(role&&vectors.has(role))appendFallback({...badge,info:badge.name});
  }
  return projected;
}

export function fromChatbus(message: ChatbusMessage): DisplayMessage {
  const user: DisplayMessage['user'] = {
    name: message.user.displayName || message.user.username,
    username: message.user.username,
    ...(message.user.id ? { id: message.user.id } : {}),
    ...(message.user.roles?.length ? {roles:[...message.user.roles]}:{}),
    ...(projectNamePaint(message.user.namePaint)?{namePaint:projectNamePaint(message.user.namePaint)}:{}),
    badges: projectDisplayBadges(message.user.badges ?? [],message.user.badgeRefs ?? []),
    ...(message.user.color ? { color: message.user.color } : {}),
  };
  return {
    id: message.id, timestamp: message.timestamp, user,
    ...(message.platform?{platform:message.platform}:{}),
    ...(message.channelName?{channelName:message.channelName}:{}),
    ...(message.traits?{traits:{...message.traits}}:{}),
    ...(message.reply?{reply:{...message.reply}}:{}),
    parts: message.fragments.map(fragment => {
      if(fragment.type==='mention')return {type:'mention' as const,text:fragment.text,
        ...(fragment.username?{username:fragment.username}:{}),
        ...(fragment.userId?{userId:fragment.userId}:{})};
      if(fragment.type==='media' && fragment.url && fragment.mediaType)
        return {type:'media' as const,text:fragment.text,mediaType:fragment.mediaType,
          url:fragment.url,...(fragment.alt?{alt:fragment.alt}:{})};
      if ((fragment.type === 'emote' || fragment.type === 'modifier' || fragment.type === 'cheermote') && fragment.emote) {
        const emote = fragment.emote;
        return {
          type: 'emote' as const,
          ...(fragment.type==='cheermote' && Number.isSafeInteger(fragment.bits) ? {bits:fragment.bits}:{}),
          emote: {
            id: emote.id, code: emote.code, url: emote.url,
            ...(emote.provider?{provider:emote.provider}:{}),
            ...(emote.animated!==undefined?{animated:emote.animated}:{}),
            ...(emote.content?{content:{...emote.content}}:{}),
            overlays: (fragment.overlays ?? []).map(x => ({ code: x.code, url: x.url,
              ...(x.modifierFlags!==undefined?{flags:x.modifierFlags}:{}) })),
            modifiers: (fragment.modifiers ?? []).map(x => ({ code: x.code, flags: x.modifierFlags ?? 0 })),
          },
        };
      }
      return { type: 'text' as const, text: fragment.text };
    }),
  };
}
