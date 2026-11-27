import { describe,it,expect } from 'vitest';
import { projectNamePaint } from '../src/chatbus';
import { createChatMessageElement,setChatNamePaint } from '../src/renderers';
import type { NamePaint } from '@myrqyry/chatbus';
import type { DisplayMessage } from '../src/chatbus';

const candy:NamePaint={
 id:'01FQ8S87J8000BDD0YMN21KEXG',provider:'7tv',name:'Candy Cane',
 function:'LINEAR_GRADIENT',angle:45,repeat:true,
 stops:[{at:.1,color:-757935361},{at:.2,color:-757935361},{at:.2,color:-10197761},{at:.3,color:-10197761}],
 gradients:[],shadows:[{xOffset:-1,yOffset:0,radius:.7,color:102}],
 text:{weight:6,transform:'uppercase',stroke:{width:2,color:-757935361},
  shadows:[{xOffset:1,yOffset:2,radius:3,color:-10197761}]},
};
const message=(paint?:NamePaint):DisplayMessage=>({
 id:'paints',timestamp:1000,user:{name:'Painted',color:'#55aaee',badges:[],
  ...(paint?{namePaint:projectNamePaint(paint)}:{})},parts:[{type:'text',text:' hello'}],
});
describe('real 7TV paint projection and username rendering',()=>{
 it('renders the live-observed legacy repeat gradient and signed ARGB stops',()=>{
  const projected=projectNamePaint(candy);
  expect(projected).toMatchObject({
   gradients:[{function:'LINEAR_GRADIENT',repeat:true,angle:45,stops:[
    {at:.1,color:(-757935361>>>0)},{at:.2,color:(-757935361>>>0)},
    {at:.2,color:(-10197761>>>0)},{at:.3,color:(-10197761>>>0)},
   ]}],
   text:{weight:6,transform:'uppercase',stroke:{width:2,color:(-757935361>>>0)}},
  });
  const row=createChatMessageElement(message(candy));
  const name=row.querySelector<HTMLElement>('[data-username]')!;
  expect(name.style.backgroundImage).toContain('repeating-linear-gradient(45deg');
  expect(name.style.backgroundImage).toContain('10%');
  expect(name.style.backgroundImage).toContain('20%');
  expect(name.style.webkitTextFillColor).toBe('transparent');
  expect(name.style.fontWeight).toBe('600');
  expect(name.style.textTransform).toBe('uppercase');
  expect(name.style.webkitTextStrokeWidth).toBe('2px');
  expect(name.style.filter).toContain('drop-shadow(');
 });
 it('does not inherit OverlayKit dark shadow into a 7TV painted username, retaining the message shadow',()=>{
  const layered={
    id:'bright-layers',provider:'7tv',layers:[
      {kind:'solid',color:0xff88ffee,opacity:1},
      {kind:'linear',angle:45,repeating:false,opacity:.8,stops:[
        {at:0,color:0xff00ffff},{at:1,color:0xffff66aa},
      ]},
    ],
  } as unknown as NamePaint;
  const row=createChatMessageElement(message(layered),{shadow:'strong'});
  const wrapper=row.querySelector<HTMLElement>('[data-username-wrap]')!;
  const name=wrapper.querySelector<HTMLElement>('[data-username]')!;
  const layers=wrapper.querySelectorAll<HTMLElement>('[data-name-paint-layer]');
  expect(row.style.textShadow).toContain('rgba(0,0,0');
  expect(wrapper.style.textShadow).toBe('none');
  expect(name.style.textShadow).toBe('none');
  expect(layers).toHaveLength(2);
  expect(Array.from(layers).every(layer=>layer.style.textShadow==='none')).toBe(true);
  expect(row.querySelector<HTMLElement>('.overlay-message-content')?.style.textShadow).toBe('');
  setChatNamePaint(row,undefined);
  expect(wrapper.style.textShadow).toBe('');
  expect(name.style.textShadow).toBe('');
  expect(wrapper.querySelectorAll('[data-name-paint-layer]')).toHaveLength(0);
  setChatNamePaint(row,projectNamePaint(layered));
  expect(wrapper.style.textShadow).toBe('none');
 });

 it('retains provider-owned 7TV shadow effects, but never adds OverlayKit shadow to the paint',()=>{
  const providerPaint:NamePaint={
    id:'provider-shadow',provider:'7tv',function:'LINEAR_GRADIENT',angle:90,
    stops:[{at:0,color:0xff00fefe},{at:1,color:0xffee33ff}],
    text:{shadows:[{xOffset:1,yOffset:2,radius:3,color:0xff776655}]},
    shadows:[{xOffset:0,yOffset:1,radius:2,color:0xff887766}],
  };
  const row=createChatMessageElement(message(providerPaint),{shadow:'strong'});
  const wrapper=row.querySelector<HTMLElement>('[data-username-wrap]')!;
  const name=wrapper.querySelector<HTMLElement>('[data-username]')!;
  expect(wrapper.style.textShadow).toBe('none');
  // Legacy gradient paints render the 7TV effect on the username element,
  // rather than the wrapper used for v4 independent paint layers.
  expect(name.style.filter).toContain('drop-shadow(');
  expect(name.style.textShadow).toContain('1px 2px 3px');
  expect(name.style.textShadow).not.toContain('rgba(0, 0, 0');
  setChatNamePaint(row,undefined);
  expect(wrapper.style.filter).toBe('');
  expect(wrapper.style.textShadow).toBe('');
  expect(name.style.textShadow).toBe('');
 });

 it('keeps OverlayKit text shadows for ordinary usernames and messages',()=>{
  const row=createChatMessageElement(message(),{shadow:'strong'});
  const name=row.querySelector<HTMLElement>('[data-username]')!;
  const wrapper=row.querySelector<HTMLElement>('[data-username-wrap]')!;
  expect(wrapper.style.textShadow).toBe('');
  expect(name.style.textShadow).toBe('');
  expect(row.style.textShadow).toContain('rgba(0,0,0');
 });

 it('preserves a live 7TV gradient stop beyond 100 percent',()=>{
  const paint:NamePaint={id:'extended',provider:'7tv',function:'LINEAR_GRADIENT',
    stops:[{at:0,color:-16776961},{at:1.01,color:-65536}]};
  const projected=projectNamePaint(paint)!;
  expect(projected.gradients?.[0].stops[1].at).toBe(1.01);
  const row=createChatMessageElement(message(paint));
  expect(row.querySelector<HTMLElement>('[data-username]')?.style.backgroundImage)
    .toContain('101%');
 });

 it('renders radial, repeating and multi-layer gradients without losing position or size',()=>{
  const paint:NamePaint={id:'many',provider:'7tv',gradients:[
   {function:'RADIAL_GRADIENT',shape:'ellipse',repeat:true,at:[.2,.8],
    canvasSize:[.7,.6],canvasRepeat:'repeat-x',
    stops:[{at:0,color:-16776961},{at:1,color:-65536}]},
   {function:'LINEAR_GRADIENT',angle:120,stops:[{at:0,color:0xff334455},{at:1,color:0xff667788}]},
  ]};
  const row=createChatMessageElement(message(paint));
  const name=row.querySelector<HTMLElement>('[data-username]')!;
  expect(projectNamePaint(paint)?.gradients?.[0].shape).toBe('ellipse');
  // CSSOM may omit the redundant default ellipse keyword on serialization.
  expect(name.style.backgroundImage).toContain('repeating-radial-gradient(');
  expect(name.style.backgroundImage).toContain('linear-gradient(120deg');
  expect(name.style.backgroundPosition).toContain('20% 80%');
  expect(name.style.backgroundSize).toContain('70% 60%');
  expect(name.style.backgroundRepeat).toContain('repeat-x');
 });
 it('preserves ordered 7TV v4 paint layers and renders independent gradient opacity without duplicating username text',()=>{
  const layered={
   id:'v4-layered',provider:'7tv',layers:[
    {kind:'solid',color:0xff112233,opacity:1},
    {kind:'linear',angle:35,repeating:false,opacity:.4,stops:[
     {at:0,color:0xffff0000},{at:1,color:0xff00ff00},
    ]},
    {kind:'radial',shape:'circle',repeating:true,opacity:.65,stops:[
     {at:0,color:0xffffffff},{at:1.01,color:0xff0000ff},
    ]},
    {kind:'image',url:'https://cdn.7tv.app/paint/layer.webp',opacity:.75},
    {kind:'image',url:'javascript:alert(1)',opacity:1},
   ],
  } as unknown as NamePaint;
  const projected=projectNamePaint(layered);
  expect(projected?.layers).toEqual([
   {kind:'solid',color:0xff112233,opacity:1},
   {kind:'linear',angle:35,repeating:false,opacity:.4,stops:[
    {at:0,color:0xffff0000},{at:1,color:0xff00ff00},
   ]},
   {kind:'radial',shape:'circle',repeating:true,opacity:.65,stops:[
    {at:0,color:0xffffffff},{at:1.01,color:0xff0000ff},
   ]},
   {kind:'image',url:'https://cdn.7tv.app/paint/layer.webp',opacity:.75},
  ]);
  const row=createChatMessageElement(message(layered));
  const name=row.querySelector<HTMLElement>('[data-username]')!;
  expect(name.textContent).toBe('Painted');
  const layers=row.querySelectorAll<HTMLElement>('[data-name-paint-layer]');
  expect(layers).toHaveLength(4);
  const layerList=Array.from(layers);
  expect(layerList.some(layer=>layer.style.backgroundImage.includes('cdn.7tv.app/paint/layer.webp'))).toBe(true);
  expect(layerList.some(layer=>layer.style.backgroundImage.includes('linear-gradient('))).toBe(true);
  expect(layerList.some(layer=>layer.style.backgroundImage.includes('radial-gradient('))).toBe(true);
  expect(name.style.opacity).toBe('0');
  setChatNamePaint(row,undefined);
  expect(row.querySelectorAll('[data-name-paint-layer]')).toHaveLength(0);
  expect(name.style.opacity).toBe('');
  expect(name.style.color).toBe('rgb(85, 170, 238)');
 });

 it('accepts only safe image URLs, rejects invalid ARGB and restores native name color when paint removed',()=>{
  const paint:NamePaint={id:'image',provider:'7tv',gradients:[
   {function:'URL',imageUrl:'https://cdn.7tv.app/paint/image.webp',stops:[]},
   {function:'URL',imageUrl:'javascript:alert(1)',stops:[]},
  ]};
  const row=createChatMessageElement(message());
  const name=row.querySelector<HTMLElement>('[data-username]')!;
  setChatNamePaint(row,projectNamePaint(paint));
  expect(name.style.backgroundImage).toContain('https://cdn.7tv.app/paint/image.webp');
  expect(name.style.backgroundImage).not.toContain('javascript');
  setChatNamePaint(row,projectNamePaint(candy));
  setChatNamePaint(row,undefined);
  expect(name.style.backgroundImage).toBe('');
  expect(name.style.filter).toBe('');
  expect(name.style.fontWeight).toBe('');
  expect(name.style.textTransform).toBe('');
  expect(name.style.webkitTextStrokeWidth).toBe('');
  expect(name.style.color).toBe('rgb(85, 170, 238)');
  expect(projectNamePaint({id:'bad',provider:'7tv',color:Number.NaN})?.color).toBeUndefined();
 });
});