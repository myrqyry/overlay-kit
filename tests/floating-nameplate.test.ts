// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {createChatMessageElement,syncFloatingNameplateNotch,roundedFloatingNotchShape} from '../src/renderers';
import {createChatFeed} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import type {DisplayMessage} from '../src/chatbus';
const img='https://static-cdn.jtvnw.net/badges/v1/1/3';
const sample=(id='float-one'):DisplayMessage=>({
  id,timestamp:42,platform:'twitch',channelName:'garden',
  user:{name:'Ada',username:'ada',color:'#AABBCC',badges:[{name:'Subscriber',provider:'twitch',id:'subscriber',url:img}]},
  parts:[{type:'text',text:'Hello from Ada'}],
});
describe('optional floating identity nameplate',()=>{
 it('keeps inline as default and roundtrips the option through presets/editor/source URL',()=>{
  expect(DEFAULT_OPTIONS.nameplateStyle).toBe('inline');
  const control=optionsForEditor('chat',false).find(x=>x.key==='nameplateStyle');
  expect(control).toMatchObject({kind:'select',section:'Chat • Layout'});
  expect(control?.choices?.map(x=>x.value)).toEqual(['inline','floating']);
  expect(normalizeOptions({nameplateStyle:'not-real'}).nameplateStyle).toBe('inline');
  const floating=normalizeOptions({nameplateStyle:'floating'});
  expect(writeOptions(floating,'chat')).toContain('nameplate=floating');
  expect(readOptions('?nameplate=floating','chat').nameplateStyle).toBe('floating');
  expect(writeOptions(floating,'wall')).not.toContain('nameplate');
  expect(writeOptions(normalizeOptions({}),'chat')).not.toContain('nameplate');
 });
 it('places the existing badge + name group on the top-edge nameplate, preserving message content',()=>{
  const inline=createChatMessageElement(sample());
  expect(inline.dataset.nameplate).toBe('inline');
  const floating=createChatMessageElement(sample(),{nameplateStyle:'floating',messageOutline:3});
  expect(floating.dataset.nameplate).toBe('floating');
  expect(floating.dataset.nameplateEmpty).toBe('false');
  const header=floating.querySelector<HTMLElement>('.overlay-message-header')!;
  expect(header.parentElement).toBe(floating);
  expect(header.style.position).toBe('relative'); // Header must contribute intrinsic width.
  expect(header.style.overflow).toBe('visible'); // Never crop profile rings or raised badge artwork.
  expect(header.querySelector('[data-badge-container] .overlay-badge')).not.toBeNull();
  expect(header.querySelector('[data-username]')?.textContent).toBe('Ada');
  expect(header.querySelector('.overlay-service-badge[data-platform="twitch"]')).not.toBeNull();
  expect(floating.querySelector('.overlay-message-body')?.textContent).toBe('Hello from Ada');
  expect(floating.style.borderWidth).toBe('3px');
 });
 it('notches the paint outline around the floating identity without a solid backing',()=>{
  const withPaint=sample('notch');
  withPaint.user.namePaint={id:'paint',provider:'7tv',layers:[
    {kind:'linear',angle:90,repeating:false,opacity:1,stops:[
      {at:0,color:0xffff0000},{at:1,color:0xff0000ff},
    ]},
  ]};
  const root=createChatMessageElement(withPaint,{nameplateStyle:'floating',messageOutline:3});
  const header=root.querySelector<HTMLElement>('.overlay-message-header')!;
  const layer=root.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
    left:24,right:165,top:2,bottom:34,width:141,height:32
  })});
  Object.defineProperty(layer,'getBoundingClientRect',{value:()=>({
    left:0,right:302,top:0,bottom:102,width:302,height:102
  })});
  syncFloatingNameplateNotch(root);
  expect(layer.style.clipPath).toContain('polygon(');
  // Give painted glyphs and strokes a real clearance on both sides;
  // a 2px notch margin lets the curved border touch the final letter.
  expect(layer.style.clipPath).toContain('20px');
  expect(layer.style.clipPath).toContain('169px');
  expect(layer.style.backgroundImage).toContain('linear-gradient');
 });

 it('rounds both top-border cut ends with responsive caps, preserving the current gap',()=>{
  // A 3px stroke gets 1.5px-radius caps. Their furthest reach is the
  // original 14px / 175px clipping boundary; no new bubble width is added.
  const path=roundedFloatingNotchShape(302,102,14,175,5,3);
  expect(path).toMatch(/^shape\(from 0 0, /);
  expect(path).toContain('12.5px 0');
  expect(path).toContain('176.5px 0');
  expect(path).toContain('line to 100% 0');
  expect(path).toContain('line to 100% 100%');
  expect((path.match(/curve to/g)||[])).toHaveLength(4);
  expect(path).toContain('close)');
 });

 it('applies rounded ends to both solid and gradient paints when CSS shape clips are supported',()=>{
  const paint=sample('rounded-gradient');
  paint.user.namePaint={id:'g',provider:'7tv',layers:[{
    kind:'linear',angle:90,repeating:false,opacity:1,stops:[
      {at:0,color:0xff22ccdd},{at:1,color:0xffaa33cc},
    ],
  }]};
  const originalCss=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:(property:string,value:string)=>
    property==='clip-path' && value.startsWith('shape(')});
  try {
    for(const row of [
      createChatMessageElement(sample('rounded-solid'),{nameplateStyle:'floating',messageOutline:3}),
      createChatMessageElement(paint,{nameplateStyle:'floating',messageOutline:3}),
    ]){
      const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
      const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
      Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
        left:24,right:165,top:2,bottom:34,width:141,height:32,
      })});
      Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({
        left:0,right:302,top:0,bottom:102,width:302,height:102,
      })});
      syncFloatingNameplateNotch(row);
      expect(ring.style.clipPath).toContain('shape(');
      expect(ring.style.clipPath).toContain('line to 100% 100%');
      expect((ring.style.clipPath.match(/curve to/g)||[])).toHaveLength(4);
      expect(row.dataset.nameplate).toBe('floating');
    }
  }finally{
    vi.unstubAllGlobals();
    if(originalCss)globalThis.CSS=originalCss;
  }
 });

 it('never chooses absolute path() even when only path() is supported',()=>{
  const row=createChatMessageElement(sample('stale-path'),{
    nameplateStyle:'floating',messageOutline:3,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
    left:24,right:165,top:2,bottom:34,width:141,height:32,
  })});
  Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({
    left:0,right:302,top:0,bottom:102,width:302,height:102,
  })});
  const original=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:(_property:string,value:string)=>value.startsWith('path(')});
  try {
    syncFloatingNameplateNotch(row);
    expect(ring.style.clipPath).toContain('polygon(');
    expect(ring.style.clipPath).toContain('100% 100%');
    expect(ring.style.clipPath).not.toContain('path("');
  }finally{vi.unstubAllGlobals();if(original)globalThis.CSS=original}
 });

 it('calculates the notch in local CSS pixels under scaled entrance transforms',()=>{
  const row=createChatMessageElement(sample('scaled-enter'),{
    nameplateStyle:'floating',messageOutline:3,fontSize:20,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  // The row is rendered at scale(.5). Bounding rectangles are transformed,
  // but offset dimensions remain CSS layout pixels. The gap MUST use offsets.
  Object.defineProperties(ring,{
    offsetWidth:{value:300},offsetHeight:{value:100},offsetLeft:{value:-3},
    getBoundingClientRect:{value:()=>({left:10,right:160,top:10,bottom:60,width:150,height:50})},
  });
  Object.defineProperties(header,{
    offsetWidth:{value:140},offsetHeight:{value:28},offsetLeft:{value:25},
    getBoundingClientRect:{value:()=>({left:24,right:94,top:16,bottom:28,width:70,height:12})},
  });
  const original=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:(_property:string,value:string)=>value.startsWith('shape(')});
  try{
    syncFloatingNameplateNotch(row);
    expect(ring.style.clipPath).toContain('shape(');
    // Header begins at 28px from the ring, clearance is 4px -> 24px.
    // A transformed viewport rectangle would incorrectly produce 10px.
    expect(ring.style.clipPath).toContain('22.5px 0');
    expect(ring.style.clipPath).toContain('line to 100% 100%');
  }finally{vi.unstubAllGlobals();if(original)globalThis.CSS=original}
 });

 it('initializes the notch when an entrance transform temporarily scales the row to zero',()=>{
  const row=createChatMessageElement(sample('scale-zero'),{
    nameplateStyle:'floating',messageOutline:3,fontSize:20,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  const collapsed=()=>({left:0,right:0,top:0,bottom:0,width:0,height:0});
  Object.defineProperties(ring,{
    offsetWidth:{value:300},offsetHeight:{value:110},offsetLeft:{value:-3},
    getBoundingClientRect:{value:collapsed},
  });
  Object.defineProperties(header,{
    offsetWidth:{value:140},offsetHeight:{value:28},offsetLeft:{value:25},
    getBoundingClientRect:{value:collapsed},
  });
  const original=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:(_property:string,value:string)=>value.startsWith('shape(')});
  try {
    syncFloatingNameplateNotch(row);
    expect(ring.style.clipPath).toContain('shape(');
    expect(ring.style.clipPath).toContain('line to 100% 100%');
  }finally{vi.unstubAllGlobals();if(original)globalThis.CSS=original}
 });

 it('preserves the upper-left top stroke with crowded badges and a long username',()=>{
  const row=createChatMessageElement(sample('crowded-label'),{
    nameplateStyle:'floating',messageOutline:3,fontSize:24,usernameSize:24,radius:24,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  // Exactly the case in the user screenshot: start of the header is only
  // 29px into a bubble whose top straight edge begins near x=24px.
  // Use its 6px inset so the gap doesn't swallow the top-left border.
  header.style.paddingLeft='6px';
  header.style.paddingRight='6px';
  Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
    left:29,right:255,top:0,bottom:30,width:226,height:30,
  })});
  Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({
    left:0,right:284,top:0,bottom:65,width:284,height:65,
  })});
  const original=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:(_property:string,value:string)=>value.startsWith('shape(')});
  try{
    syncFloatingNameplateNotch(row);
    // A 3px stroke gets 4px of ink clearance, but the header has 6px of
    // padding. The left cut is at 31px, after the 24px rounded corner;
    // before this change it began at 17px and erased the top-left stroke.
    expect(ring.style.clipPath).toContain('shape(');
    expect(ring.style.clipPath).toContain('29.5px 0');
    expect(ring.style.clipPath).toContain('254.5px 0');
  }finally{vi.unstubAllGlobals();if(original)globalThis.CSS=original}
 });

 it('falls back to a responsive polygon when CSS shape clips are unsupported',()=>{
  const row=createChatMessageElement(sample('legacy-browser'),{
    nameplateStyle:'floating',messageOutline:4,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
    left:30,right:143,top:0,bottom:27,width:113,height:27,
  })});
  Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({
    left:0,right:260,top:0,bottom:90,width:260,height:90,
  })});
  const originalCss=globalThis.CSS;
  vi.stubGlobal('CSS',{supports:()=>false});
  try {
    syncFloatingNameplateNotch(row);
    expect(ring.style.clipPath).toContain('polygon(');
    expect(ring.style.clipPath).not.toContain('shape(');
  }finally{
    vi.unstubAllGlobals();
    if(originalCss)globalThis.CSS=originalCss;
  }
 });

 it('only clears the top outline stroke even when badges or username are tall',()=>{
  const row=createChatMessageElement(sample('deep-notch'),{
    nameplateStyle:'floating',messageOutline:3,fontSize:12,usernameSize:42,
  });
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  Object.defineProperty(header,'getBoundingClientRect',{value:()=>({
    left:25,right:190,top:-18,bottom:64,width:165,height:82,
  })});
  Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({
    left:0,right:256,top:0,bottom:140,width:256,height:140,
  })});
  syncFloatingNameplateNotch(row);
  const clip=ring.style.clipPath;
  expect(clip).toContain('polygon(');
  // Only the 3px top border plus a tiny anti-alias allowance is removed,
  // NOT the 64px below the header that erases the left/right top corners.
  expect(clip).toContain('5px');
  expect(clip).not.toContain('64px');
  expect(clip).not.toContain('84px');
  expect(clip).toContain('4px'); // horizontal clearance keeps the left side.
  expect(clip).toContain('194px'); // 4px beyond header ink, independent of username height.
 });

 it('sizes the entire identity badge row to username size in all layout modes',()=>{
  for(const nameplateStyle of ['inline','floating'] as const){
    const large=createChatMessageElement(sample('large-'+nameplateStyle),{
      nameplateStyle,fontSize:12,usernameSize:34,showPlatformBadges:true,
    });
    const header=large.querySelector<HTMLElement>('.overlay-message-header')!;
    const username=header.querySelector<HTMLElement>('[data-username-wrap]')!;
    const badge=header.querySelector<HTMLElement>('.overlay-badge')!;
    const platform=header.querySelector<HTMLElement>('.overlay-service-badge')!;
    expect(large.style.fontSize).toBe('12px');
    expect(header.style.fontSize).toBe('34px');
    expect(username.style.fontSize).toBe('34px');
    expect(badge.getAttribute('style')).toBeNull(); // size comes from inheritance.
    expect(platform.style.width).toBe(''); // follows header font via em.
    if(nameplateStyle==='floating')
      expect(large.style.getPropertyValue('--chat-nameplate-overhang')).toBe('23.8px');
    const small=createChatMessageElement(sample('small-'+nameplateStyle),{
      nameplateStyle,fontSize:36,usernameSize:13,
    });
    expect(small.style.fontSize).toBe('36px');
    expect(small.querySelector<HTMLElement>('.overlay-message-header')?.style.fontSize).toBe('13px');
    const inherited=createChatMessageElement(sample('default-'+nameplateStyle),{
      nameplateStyle,fontSize:26,usernameSize:0,
    });
    expect(inherited.querySelector<HTMLElement>('.overlay-message-header')?.style.fontSize).toBe('');
    expect(inherited.style.getPropertyValue('--chat-nameplate-overhang')).toBe('');
  }
 });

 it('reserves actual top-border corners around a large floating nameplate',()=>{
  const row=createChatMessageElement(sample('corner'),{
    nameplateStyle:'floating',fontSize:12,usernameSize:36,radius:18,messageOutline:3,
  });
  // Rounded borders must remain visible beyond the nameplate on a normal-width
  // source; use CSS responsive padding rather than cutting through the label.
  expect(row.style.getPropertyValue('--chat-nameplate-gutter')).toBe('27px');
  const matched=createChatMessageElement(sample('corner-default'),{
    nameplateStyle:'floating',fontSize:20,radius:12,messageOutline:3,
  });
  expect(matched.style.getPropertyValue('--chat-nameplate-gutter')).toBe('18px');
  const round=createChatMessageElement(sample('corner-round'),{
    nameplateStyle:'floating',fontSize:20,usernameSize:36,radius:40,messageOutline:3,
  });
  expect(round.style.getPropertyValue('--chat-nameplate-gutter')).toBe('34px');
  const inline=createChatMessageElement(sample('corner-inline'),{
    nameplateStyle:'inline',fontSize:20,usernameSize:36,radius:18,messageOutline:3,
  });
  expect(inline.style.getPropertyValue('--chat-nameplate-gutter')).toBe('');
 });

 it('notches solid-color outlines too, without covering the label',()=>{
  const row=createChatMessageElement(sample('solid'),{
    nameplateStyle:'floating',messageOutline:2,backgroundAlpha:0,
  });
  expect(row.style.borderColor).toBe('transparent');
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  expect(ring).toBeTruthy();
  expect(ring.style.borderStyle).toBe('solid');
  expect(ring.style.borderWidth).toBe('2px');
  expect(ring.style.borderColor).toBe('rgba(246, 240, 233, 0.42)');
  expect(ring.style.backgroundImage).toBe('');
  expect(ring.style.mask).toBe('');
  expect(row.querySelector('.overlay-message-header')?.getAttribute('style')).not.toContain('background');
 });

 it('renders a 7TV solid-color floating outline with a native rounded border',()=>{
  const painted=sample('solid-paint');
  painted.user.namePaint={provider:'7tv',id:'solid-paint',layers:[{
    kind:'solid',color:0xff29e4d2,opacity:.8,
  }]};
  const row=createChatMessageElement(painted,{
    nameplateStyle:'floating',messageOutline:3,radius:34,backgroundAlpha:0,
  });
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  expect(ring.style.borderStyle).toBe('solid');
  expect(ring.style.borderWidth).toBe('3px');
  expect(ring.style.borderColor).toBe('rgb(41, 228, 210)');
  expect(ring.style.opacity).toBe('0.8');
  expect(ring.style.mask).toBe('');
  expect(ring.style.backgroundImage).toBe('');
 });

 it('keeps the masked rounded paint outline for genuine gradient artwork',()=>{
  const painted=sample('gradient-paint');
  painted.user.namePaint={provider:'7tv',id:'gradient-paint',layers:[{
    kind:'linear',angle:90,repeating:false,opacity:1,
    stops:[{at:0,color:0xfff04c6f},{at:1,color:0xff5978ff}],
  }]};
  const row=createChatMessageElement(painted,{nameplateStyle:'floating',messageOutline:3});
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  expect(ring.style.backgroundImage).toContain('linear-gradient(90deg');
  expect(ring.style.maskComposite).toBe('exclude');
  expect(ring.style.borderStyle).toBe('');
 });

 it('releases geometry observers on appearance replacement and row disposal',()=>{
  const records:{observed:Element[];disconnected:boolean}[]=[];
  class FakeResizeObserver {
    private record={observed:[] as Element[],disconnected:false};
    constructor(_callback:ResizeObserverCallback){records.push(this.record)}
    observe(target:Element){this.record.observed.push(target)}
    disconnect(){this.record.disconnected=true}
    unobserve(){}
  }
  vi.stubGlobal('ResizeObserver',FakeResizeObserver);
  try{
    const root=document.createElement('div');
    const feed=createChatFeed(root,{nameplateStyle:'floating',messageOutline:2,ttlMs:120000});
    feed.receive(sample('observe'));
    // The feed also uses its own ResizeObserver for layout; only track the
    // separately owned floating-header observers here.
    const owned=()=>records.filter(r=>r.observed.some(node=>
      node.classList.contains('overlay-message-header')));
    expect(owned()).toHaveLength(1);
    expect(owned()[0].observed).toHaveLength(2);
    feed.configure({nameplateStyle:'inline'});
    feed.refreshAppearance();
    expect(owned()[0].disconnected).toBe(true);
    feed.configure({nameplateStyle:'floating'});
    feed.refreshAppearance();
    expect(owned()).toHaveLength(2);
    feed.dispose();
    expect(owned()[1].disconnected).toBe(true);
  }finally{vi.unstubAllGlobals()}
 });

 it('does not reserve a floating header if all identity elements are disabled',()=>{
  const row=createChatMessageElement(sample(),{
    nameplateStyle:'floating',showNames:false,showBadges:false,showPlatformBadges:false,
  });
  expect(row.dataset.nameplateEmpty).toBe('true');
  expect(row.querySelector('.overlay-message-header')?.getAttribute('data-empty')).toBe('true');
  expect(row.querySelector('.overlay-message-content')?.textContent).toBe('Hello from Ada');
 });
 it('reveals and removes a badge-only floating label via late patches without remounting the row',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{
    nameplateStyle:'floating',showNames:false,showPlatformBadges:false,
    showBadges:true,layout:'stack',ttlMs:120000,
  });
  feed.receive({...sample('late'),user:{name:'Ada',badges:[]}});
  const row=root.querySelector<HTMLElement>('[data-message-id=late]')!;
  const before=feed.snapshot()[0]!.enteredAt;
  expect(row.dataset.nameplateEmpty).toBe('true');
  feed.updateBadges('late',[{name:'Gifter',provider:'kick',id:'sub_gifter',text:'GIFT 1'}]);
  expect(row.dataset.nameplateEmpty).toBe('false');
  expect(row.querySelector('.overlay-badge-fallback')?.textContent).toBe('GIFT 1');
  feed.updateBadges('late',[]);
  expect(row.dataset.nameplateEmpty).toBe('true');
  expect(root.querySelector('[data-message-id=late]')).toBe(row);
  expect(feed.snapshot()[0]?.enteredAt).toBe(before);
  feed.dispose();
 });
 it('switches current messages between modes without changing scene ownership or 7TV outlines',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{nameplateStyle:'inline',layout:'strip',ttlMs:120000,messageOutline:2});
  feed.receive(sample('switch'));
  const row=root.querySelector<HTMLElement>('[data-message-id=switch]')!;
  const started=feed.snapshot()[0]!.enteredAt;
  for(const layout of ['strip','spotlight','stack'] as const){
    feed.configure({layout,nameplateStyle:'floating'});
    feed.refreshAppearance();
    expect(row.dataset.nameplate).toBe('floating');
    expect(row.querySelector('.overlay-message-header [data-username]')?.textContent).toBe('Ada');
    expect(row.querySelector('.overlay-message-body')?.textContent).toBe('Hello from Ada');
    expect(row.style.borderWidth).toBe('2px');
    expect(root.querySelector('[data-message-id=switch]')).toBe(row);
  }
  feed.configure({nameplateStyle:'inline'});
  feed.refreshAppearance();
  expect(row.dataset.nameplate).toBe('inline');
  expect(feed.snapshot()[0]?.enteredAt).toBe(started);
  feed.dispose();
 });
});
