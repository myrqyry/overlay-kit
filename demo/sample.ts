import { fromChatbus, type DisplayMessage, type DisplayNamePaint } from '../src/chatbus';
import type {PreviewAssetProfile} from '../src/preview-asset-cache';

/** Synthetic preview fixtures only; live chat comes from Chatbus. */
const lines = [
  { name: 'CloudCat', color: '#f7b6ad', text: 'Oh this looks so cozy! ☕ ', emoji: 'smile', overlay: true },
  { name: 'Mossy', color: '#a6dec4', text: 'That animation!! 🌙 ', emoji: 'heart', overlay: false },
  { name: 'OrbitFox', color: '#beb3f5', text: 'another one coming through 🐈‍⬛ ', emoji: 'smile', overlay: false },
  { name: 'PenPlotter', color: '#f6d39a', text: 'little emote parade ✨ ', emoji: 'heart', overlay: true },
];
// Local paint samples guarantee visible gradient/layer test coverage *before*
// any actual Chatbus 7TV cosmetics have been observed. These are labeled preview.
const previewPaints:readonly DisplayNamePaint[]=[
  {id:'preview-gradient',provider:'custom',gradients:[{function:'LINEAR_GRADIENT',angle:28,
    stops:[{at:0,color:0xffe5a0eb},{at:0.48,color:0xff81f8d6},{at:1,color:0xfff7c979}]}]},
  {id:'preview-layered',provider:'custom',layers:[
    {kind:'linear',angle:110,repeating:false,stops:[{at:0,color:0xfff8afc7},{at:1,color:0xff777be0}],opacity:1},
    {kind:'radial',shape:'circle',repeating:false,stops:[{at:0,color:0x66fff4b1},{at:1,color:0x00fff4b1}],opacity:0.6},
  ],text:{weight:7,stroke:{width:0.5,color:0xff1d2735}}},
];

export function sampleMessage(index: number, profiles:readonly PreviewAssetProfile[]=[]): DisplayMessage {
  const line = lines[index % lines.length]!;
  const path = (name: string) => '/assets/' + name + '.svg';
  const platform=['twitch','youtube','kick','twitch'][index%4]!;
  // Prefer complete real cosmetics when available, retaining badge+paint
  // relationships within the source profile. Names/text remain fictional.
  const ranked=[...profiles].sort((a,b)=>
    Number(Boolean(b.paint))-Number(Boolean(a.paint)) ||
    b.badges.length-a.badges.length || b.emotes.length-a.emotes.length);
  const selected=ranked.length?ranked[index%ranked.length]:undefined;
  const fromSample=fromChatbus({
    id: 'preview-' + index, timestamp: Date.now(),platform,channelName:'preview',
    user: {
      username: line.name.toLowerCase(), displayName: line.name, color: line.color,
      badges: index % 2 === 0 ? [{ id: 'member', name: 'Member', url: path('badge') }] : [],
    },
    fragments: [
      { type: 'text', text: line.text },
      { type: 'emote', text: line.emoji, emote: {
        id: line.emoji, code: line.emoji, url: path(line.emoji),
      }, overlays: line.overlay ? [{ id: 'hat', code: 'hat', url: path('hat') }] : [], modifiers: [] },
    ],
  });
  const emote=selected?.emotes[index % (selected.emotes.length||1)];
  if(emote){
    fromSample.parts=fromSample.parts.map(part=>part.type==='emote'?{type:'emote',emote}:part);
  }
  fromSample.user.badges=selected?.badges.length?selected.badges:fromSample.user.badges;
  fromSample.user.namePaint=selected?.paint??previewPaints[index%previewPaints.length];
  return fromSample;
}
