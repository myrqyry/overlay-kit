import { describe, expect, it } from 'vitest';
import {createEmoteWall} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import {applyWallStylePack,getWallStylePack,listWallStylePacks,registerWallStylePack} from '../src/wall-style-packs';
import type {DisplayMessage} from '../src/chatbus';

const message=(id:string):DisplayMessage=>({
 id,timestamp:1700,user:{name:'Maker',badges:[]},parts:[{type:'emote',emote:{
 id,code:'sample',url:'/emote.png',overlays:[{code:'overlay',url:'/overlay.png'}],modifiers:[],
 }}],
});
describe('emote wall materials as reusable style packs',()=>{
 it('ships stable original, cut-paper and ink-wash material packs',()=>{
   const packs=listWallStylePacks();
   expect(packs.map(x=>x.id)).toEqual(['original','cut-paper','ink-wash','holo-foil']);
   expect(getWallStylePack('cut-paper')?.name).toBeTruthy();
   expect(getWallStylePack('https://example.com/script.js')).toBeUndefined();
 });
 it('round-trips styles through wall-only editor and OBS URLs, retaining original default',()=>{
   expect(DEFAULT_OPTIONS.wallStyle).toBe('original');
   expect(optionsForEditor('wall',false).find(o=>o.key==='wallStyle')?.choices?.map(x=>x.value))
      .toEqual(['original','cut-paper','ink-wash','holo-foil']);
   expect(optionsForEditor('chat',true).some(o=>o.key==='wallStyle')).toBe(false);
   for(const wallStyle of ['cut-paper','ink-wash','holo-foil'] as const){
      const settings=normalizeOptions({wallStyle});
      const url=writeOptions(settings,'wall');
      expect(url).toContain('wallStyle='+wallStyle);
      expect(readOptions('?'+url,'wall').wallStyle).toBe(wallStyle);
      expect(writeOptions(settings,'chat')).not.toContain('wallStyle');
   }
   expect(normalizeOptions({wallStyle:'javascript:alert(1)'}).wallStyle).toBe('original');
 });
 it('changes actual existing wall sprites without affecting active scene or layered artwork',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallStyle:'original',maxActive:5});
   wall.receive(message('before'));wall.receive(message('another'));
   const artwork=root.querySelector('[data-wall-item] .overlay-emote');
   const first=root.querySelector('.overlay-wall-visual');
   expect(root.dataset.wallStyle).toBe('original');
   wall.configure({wallStyle:'cut-paper'});
   expect(root.dataset.wallStyle).toBe('cut-paper');
   expect(root.querySelector('.overlay-wall-visual')).toBe(first);
   expect(root.querySelector('.overlay-emote')).toBe(artwork);
   expect(root.querySelectorAll('.overlay-emote img')).toHaveLength(4);
   expect(wall.snapshot()).toHaveLength(2);
   wall.configure({wallStyle:'ink-wash',wallField:'none',motion:'sway'});
   expect(root.dataset.wallStyle).toBe('ink-wash');
   expect(root.querySelector('.overlay-wall-visual')).toBe(first);
   wall.removeMessage('before');
   expect(wall.snapshot()).toHaveLength(1);
   wall.dispose();
   expect(root.dataset.wallStyle).toBeUndefined();
   expect(root.childElementCount).toBe(0);
 });
  it('mounts one bounded ink-bleed filter resource and cleans it when switching or disposing',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{wallStyle:'ink-wash',maxActive:2});
    wall.receive(message('print'));
    const filter=root.querySelector('[data-wall-ink-resource] filter');
    expect(filter).not.toBeNull();
    expect(filter?.querySelector('feGaussianBlur')).not.toBeNull();
    expect(root.style.getPropertyValue('--wall-ink-filter')).toContain(filter?.id);
    expect(root.querySelectorAll('[data-wall-ink-resource]')).toHaveLength(1);
    wall.configure({wallStyle:'original'});
    expect(root.querySelector('[data-wall-ink-resource]')).toBeNull();
    expect(root.style.getPropertyValue('--wall-ink-filter')).toBe('');
    wall.configure({wallStyle:'ink-wash'});
    expect(root.querySelectorAll('[data-wall-ink-resource]')).toHaveLength(1);
    wall.dispose();
    expect(root.querySelector('[data-wall-ink-resource]')).toBeNull();
    expect(root.childElementCount).toBe(0);
  });
  it('isolates ink filter IDs between independently mounted wall instances',()=>{
    const one=document.createElement('div'),two=document.createElement('div');
    const first=applyWallStylePack(one,'ink-wash');
    const second=applyWallStylePack(two,'ink-wash');
    const id1=one.querySelector('filter')?.id,id2=two.querySelector('filter')?.id;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    first.dispose();
    expect(two.querySelector('filter')?.id).toBe(id2);
    second.dispose();
    expect(one.childElementCount).toBe(0);
    expect(two.childElementCount).toBe(0);
  });
 it('mounts silhouette-masked holographic foil without moving or duplicating layered sprites',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallStyle:'original',wallColor:'vivid',wallFinish:'halo',maxActive:2});
   wall.receive(message('foil'));
   const visual=root.querySelector('.overlay-wall-visual');
   const artwork=root.querySelector('.overlay-emote');
   const images=Array.from(root.querySelectorAll('.overlay-emote img'));
   wall.configure({wallStyle:'holo-foil'});
   const filter=root.querySelector('[data-wall-foil-resource] filter');
   expect(root.dataset).toMatchObject({wallStyle:'holo-foil',wallColor:'vivid',wallFinish:'halo'});
   expect(filter).not.toBeNull();
   expect(filter?.querySelector('feTurbulence')).not.toBeNull();
   expect(filter?.querySelector('feComposite[operator="in"][in2="SourceAlpha"]')).not.toBeNull();
   expect(root.style.getPropertyValue('--wall-holo-filter')).toContain(filter?.id);
   expect(root.querySelector('.overlay-wall-visual')).toBe(visual);
   expect(root.querySelector('.overlay-emote')).toBe(artwork);
   expect(Array.from(root.querySelectorAll('.overlay-emote img'))).toEqual(images);
   expect(root.querySelectorAll('[data-wall-foil-resource]')).toHaveLength(1);
   wall.configure({wallStyle:'original'});
   expect(root.querySelector('[data-wall-foil-resource]')).toBeNull();
   expect(root.style.getPropertyValue('--wall-holo-filter')).toBe('');
   wall.configure({wallStyle:'holo-foil'});
   expect(root.querySelectorAll('[data-wall-foil-resource]')).toHaveLength(1);
   wall.dispose();
   expect(root.querySelector('[data-wall-foil-resource]')).toBeNull();
   expect(root.childElementCount).toBe(0);
 });
 it('isolates holographic filter IDs between independent wall roots',()=>{
   const one=document.createElement('div'),two=document.createElement('div');
   const first=applyWallStylePack(one,'holo-foil');
   const second=applyWallStylePack(two,'holo-foil');
   const id1=one.querySelector('filter')?.id,id2=two.querySelector('filter')?.id;
   expect(id1).toBeTruthy();
   expect(id2).toBeTruthy();
   expect(id1).not.toBe(id2);
   first.dispose();
   expect(two.querySelector('filter')?.id).toBe(id2);
   second.dispose();
   expect(two.childElementCount).toBe(0);
 });
 it('lets trusted locally registered packs attach and remove a bounded resource',()=>{
   const root=document.createElement('div');
   let mount=0,cleanup=0;
   const unregister=registerWallStylePack({
     id:'my-custom-material',name:'Custom',description:'a composable test',
     mount:()=>{mount++;return ()=>{cleanup++;};},
   });
   expect(()=>registerWallStylePack({id:'my-custom-material',name:'Duplicate',description:'x'})).toThrow();
   expect(()=>registerWallStylePack({id:'invalid ID!',name:'Invalid',description:'x'})).toThrow();
   const applied=applyWallStylePack(root,'my-custom-material');
   expect(root.dataset.wallStyle).toBe('my-custom-material');
   applied.dispose();applied.dispose();
   expect([mount,cleanup]).toEqual([1,1]);
   unregister();
   expect(getWallStylePack('my-custom-material')).toBeUndefined();
 });
});
