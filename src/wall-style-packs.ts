import {createLocalStyleRegistry,type LocalStylePack} from './style-pack-registry';

/** Emote-wall material treatments, separate from motion/placement/lifetime. */
export type WallStylePack=LocalStylePack;
export type BuiltinWallStyle='original'|'cut-paper'|'ink-wash'|'holo-foil';

let nextInkFilter=0;
/** One local filter per wall. The color stays with real image layers; only
 * source alpha is softened under the original artwork. No per-frame JS.
 */
function mountInkWash(root:HTMLElement):()=>void {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.dataset.wallInkResource='true';
  svg.setAttribute('width','0');
  svg.setAttribute('height','0');
  svg.setAttribute('aria-hidden','true');
  svg.style.position='absolute';
  svg.style.pointerEvents='none';
  const filter=document.createElementNS(ns,'filter');
  filter.id='overlay-wall-ink-'+(++nextInkFilter);
  filter.setAttribute('x','-25%');
  filter.setAttribute('y','-25%');
  filter.setAttribute('width','150%');
  filter.setAttribute('height','150%');
  filter.setAttribute('color-interpolation-filters','sRGB');
  const blur=document.createElementNS(ns,'feGaussianBlur');
  blur.setAttribute('in','SourceAlpha');
  blur.setAttribute('stdDeviation','1.3');
  blur.setAttribute('result','soft-edge');
  filter.append(blur);
  const bleed=document.createElementNS(ns,'feColorMatrix');
  bleed.setAttribute('in','soft-edge');
  bleed.setAttribute('type','matrix');
  bleed.setAttribute('values',
    '0 0 0 0 .32  0 0 0 0 .24  0 0 0 0 .24  0 0 0 .48 0');
  bleed.setAttribute('result','ink-bleed');
  filter.append(bleed);
  const pigment=document.createElementNS(ns,'feColorMatrix');
  pigment.setAttribute('in','SourceGraphic');
  pigment.setAttribute('type','saturate');
  pigment.setAttribute('values','.78');
  pigment.setAttribute('result','pigment');
  filter.append(pigment);
  const merge=document.createElementNS(ns,'feMerge');
  for(const result of ['ink-bleed','pigment']){
    const layer=document.createElementNS(ns,'feMergeNode');
    layer.setAttribute('in',result);
    merge.append(layer);
  }
  filter.append(merge);
  const defs=document.createElementNS(ns,'defs');
  defs.append(filter);
  svg.append(defs);
  root.prepend(svg);
  root.style.setProperty('--wall-ink-filter','url("#'+filter.id+'")');
  return ()=>{
    svg.remove();
    root.style.removeProperty('--wall-ink-filter');
  };
}

let nextFoilFilter=0;
/** Subtle spectral micro-grain blended with the real, combined artwork's
 * SourceAlpha. No per-emote clones, animations, or transport dependencies.
 * Every wall owns its filter id and removes the resource on style change.
 */
function mountHoloFoil(root:HTMLElement):()=>void {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.dataset.wallFoilResource='true';
  svg.setAttribute('width','0');
  svg.setAttribute('height','0');
  svg.setAttribute('aria-hidden','true');
  svg.style.position='absolute';
  svg.style.pointerEvents='none';
  const filter=document.createElementNS(ns,'filter');
  filter.id='overlay-wall-foil-'+(++nextFoilFilter);
  filter.setAttribute('x','-15%');
  filter.setAttribute('y','-15%');
  filter.setAttribute('width','130%');
  filter.setAttribute('height','130%');
  filter.setAttribute('color-interpolation-filters','sRGB');
  const grain=document.createElementNS(ns,'feTurbulence');
  grain.setAttribute('type','fractalNoise');
  grain.setAttribute('baseFrequency','.065 .11');
  grain.setAttribute('numOctaves','2');
  grain.setAttribute('seed','17');
  grain.setAttribute('result','foil-grain');
  filter.append(grain);
  const tint=document.createElementNS(ns,'feColorMatrix');
  tint.setAttribute('in','foil-grain');
  tint.setAttribute('type','matrix');
  // Cyan/violet/rose spectral flecks; the noise determines sparse alpha.
  tint.setAttribute('values',
    '.48 .30 .18 0 .04  .16 .37 .44 0 .05  .38 .10 .49 0 .09  .32 .26 .22 0 -.28');
  tint.setAttribute('result','spectral-flecks');
  filter.append(tint);
  const masked=document.createElementNS(ns,'feComposite');
  masked.setAttribute('in','spectral-flecks');
  masked.setAttribute('in2','SourceAlpha');
  masked.setAttribute('operator','in');
  masked.setAttribute('result','foil-on-art');
  filter.append(masked);
  const blend=document.createElementNS(ns,'feBlend');
  blend.setAttribute('in','SourceGraphic');
  blend.setAttribute('in2','foil-on-art');
  blend.setAttribute('mode','screen');
  filter.append(blend);
  const defs=document.createElementNS(ns,'defs');
  defs.append(filter);
  svg.append(defs);
  root.prepend(svg);
  root.style.setProperty('--wall-holo-filter','url("#'+filter.id+'")');
  return ()=>{
    svg.remove();
    root.style.removeProperty('--wall-holo-filter');
  };
}

const builtin:readonly WallStylePack[]=Object.freeze([
  Object.freeze({id:'original',name:'Original',description:'Raw emote artwork with no added material effects.'}),
  Object.freeze({id:'cut-paper',name:'Cut Paper',description:'Silhouette-following paper lift and soft physical shadow, not a rectangular frame.'}),
  Object.freeze({id:'ink-wash',name:'Ink Wash',description:'Subtle desaturated pigment, soft ink edge and translucent print softness.',mount:mountInkWash}),
  Object.freeze({id:'holo-foil',name:'Holo Foil',description:'Subtle spectral foil flecks clipped to the complete emote silhouette; no movement of artwork layers.',mount:mountHoloFoil}),
]);
const registry=createLocalStyleRegistry('wallStyle',builtin);
export const listWallStylePacks=registry.list;
export const getWallStylePack=registry.get;
export const registerWallStylePack=registry.register;
export const applyWallStylePack=registry.apply;
