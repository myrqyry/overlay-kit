/** Spatial alpha mask, deliberately independent of row animation and expiry. */
export const EDGE_FADE_STYLES = [
  {value:'linear',label:'Linear'},
  {value:'smooth',label:'Soft feather'},
  {value:'quick',label:'Quick recovery'},
  {value:'linger',label:'Slow recovery'},
  {value:'steps',label:'Terraced'},
  {value:'cut',label:'Hard cut'},
] as const;
export type EdgeFadeStyle = typeof EDGE_FADE_STYLES[number]['value'];
export const EDGE_FADE_PATTERNS=[
  {value:'none',label:'None'},
  {value:'dither',label:'Pixel dither'},
  {value:'grain',label:'Scattered grain'},
  {value:'fringe',label:'Torn paper'},
] as const;
export type EdgeFadePattern=typeof EDGE_FADE_PATTERNS[number]['value'];
export type EdgeFadeUnit = 'percent' | 'pixels';
export interface ChatEdgeFadeSettings {
  edgeFade?:number;
  edgeFadeStyle?:EdgeFadeStyle;
  edgeFadeUnit?:EdgeFadeUnit;
  edgeFadePixels?:number;
  edgeFadeOpacity?:number;
  edgeFadeHold?:number;
  edgeFadeSteps?:number;
  edgeFadePattern?:EdgeFadePattern;
  edgeFadePatternSize?:number;
}
type Edge = 'top'|'bottom'|'left'|'none';
const bounded=(value:number|undefined,min:number,max:number,fallback:number)=>
  typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const fmt=(n:number)=>String(Number(n.toFixed(5)));
const alpha=(n:number)=>n<=0?'transparent':n>=1?'#000':`rgba(0, 0, 0, ${fmt(n)})`;

/** Keep the original two-stop gradient byte-for-byte for legacy settings.
 * Distances in pixels shrink proportionally when the canvas is narrower. */
export function createChatEdgeMask(settings:ChatEdgeFadeSettings & {
  layout?:'stack'|'strip'|'spotlight';vertical?:'top'|'bottom';
}):{edge:Edge;image:string}{
  const pixels=settings.edgeFadeUnit==='pixels';
  const distance=pixels?bounded(settings.edgeFadePixels,0,1200,120):bounded(settings.edgeFade,0,40,0);
  const opacity=bounded(settings.edgeFadeOpacity,0,100,0)/100;
  if(!distance||opacity===1||settings.layout==='spotlight')return {edge:'none',image:''};
  const edge=settings.layout==='strip'?'left':settings.vertical==='top'?'bottom':'top';
  const direction=edge==='left'?'to right':edge==='bottom'?'to top':'to bottom';
  const hold=bounded(settings.edgeFadeHold,0,90,0)/100;
  const style=settings.edgeFadeStyle??'linear';
  const at=(t:number)=>t===0?'0%':pixels?`min(${fmt(t*100)}%, ${fmt(t*distance)}px)`:`${fmt(t*distance)}%`;
  const stops:string[]=[alpha(opacity)+' 0%'];
  const add=(fraction:number,value:number)=>stops.push(alpha(opacity+(1-opacity)*value)+' '+at(fraction));
  if(style==='cut'){
    add(1,0);add(1,1);
  }else{
    if(hold>0)add(hold,0);
    if(style==='steps'){
      const n=Math.round(bounded(settings.edgeFadeSteps,2,12,4));
      for(let i=1;i<=n;i++){
        const t=hold+(1-hold)*i/n;
        add(t,(i-1)/n);add(t,i/n);
      }
    }else if(style==='smooth'||style==='quick'||style==='linger'){
      for(let i=1;i<=8;i++){
        const t=i/8;
        const value=style==='smooth'?t*t*(3-2*t):style==='quick'?1-(1-t)**2:t*t;
        add(hold+(1-hold)*t,value);
      }
    }else add(1,1);
  }
  stops.push('#000 100%');
  return {edge,image:`linear-gradient(${direction}, ${stops.join(', ')})`};
}

type Pattern=Exclude<EdgeFadePattern,'none'>;
type LayoutEdgeSettings=ChatEdgeFadeSettings & {layout?:'stack'|'strip'|'spotlight';vertical?:'top'|'bottom'};
interface EdgeTreatment {
  edge:Edge;
  image:string;
  size:string;
  repeat:string;
  position:string;
  composite:string;
}
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const noise=(x:number,y:number)=>{
  let h=Math.imul(x+17,0x45d9f3b)^Math.imul(y+37,0x119de1f3);
  h=Math.imul(h^(h>>>16),0x45d9f3b);
  return ((h^(h>>>16))>>>0)/4294967296;
};
/** Small, fixed-size vector tile; no user strings or remote image loads.
 * Zero coverage at the departing edge, full coverage at the inner edge.
 * All patterns share 16 depth bands, independent of cross-edge grain size. */
function patternTile(pattern:Pattern,edge:Exclude<Edge,'none'>):string {
  let path='';
  if(pattern==='fringe'){
    // Join the ends of the repeating tile to avoid vertical repeat seams.
    path='M0 16V'+fmt(2+12*noise(0,0));
    for(let x=1;x<=16;x++)path+='L'+x+' '+fmt(2+12*noise(x%16,0));
    path+='V16Z';
  }else{
    for(let y=1;y<16;y++)for(let x=0;x<16;x++){
      const threshold=pattern==='dither'?(bayer[(y%4)*4+x%4]!+.5)/16:noise(x,y);
      if(y===15||threshold<y/15)path+='M'+x+' '+y+'h1v1h-1z';
    }
  }
  const transform=edge==='left'?'matrix(0 1 1 0 0 0)':edge==='bottom'?'translate(0 16) scale(1 -1)':'';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" preserveAspectRatio="none"><path fill="white" '+(pattern==='fringe'?'':'shape-rendering="crispEdges" ')+'transform="'+transform+'" d="'+path+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
}

/** Add an actual cutout layer to the existing smooth alpha profile.
 * Gradient intersect (pattern union fully opaque interior), in that order.
 * Pattern-only is possible by setting the independent edge opacity to 100. */
export function createChatEdgeTreatment(settings:LayoutEdgeSettings,supportsPattern=true):EdgeTreatment{
  const base=createChatEdgeMask(settings);
  const legacy={...base,size:'',repeat:'',position:'',composite:''};
  const pattern=settings.edgeFadePattern;
  if(pattern!=='dither'&&pattern!=='grain'&&pattern!=='fringe')return legacy;
  const {edge}=createChatEdgeMask({...settings,edgeFadeOpacity:0});
  if(edge==='none')return legacy;
  if(!supportsPattern)return base.image?legacy:{...legacy,...createChatEdgeMask({...settings,edgeFadeOpacity:0,edgeFadeStyle:'linear',edgeFadeHold:0})};
  const pixels=settings.edgeFadeUnit==='pixels';
  const depth=pixels?'min(100%, '+fmt(bounded(settings.edgeFadePixels,0,1200,120))+'px)':fmt(bounded(settings.edgeFade,0,40,0))+'%';
  const tile=fmt(16*bounded(settings.edgeFadePatternSize,2,24,6))+'px';
  const direction=edge==='left'?'to right':edge==='bottom'?'to top':'to bottom';
  const images=[patternTile(pattern,edge),'linear-gradient('+direction+', transparent 0%, transparent '+depth+', #000 '+depth+', #000 100%)'];
  const sizes=[edge==='left'?depth+' '+tile:tile+' '+depth,'100% 100%'];
  const repeats=[edge==='left'?'repeat-y':'repeat-x','no-repeat'];
  const positions=[edge==='bottom'?'left bottom':'left top','left top'];
  const composites=['add','add'];
  if(base.image){
    images.unshift(base.image);sizes.unshift('100% 100%');
    repeats.unshift('no-repeat');positions.unshift('left top');
    composites.unshift('intersect');
  }
  return {edge,image:images.join(', '),size:sizes.join(', '),repeat:repeats.join(', '),position:positions.join(', '),composite:composites.join(', ')};
}
