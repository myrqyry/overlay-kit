import type { DisplayMessage } from './chatbus';
import {createAvatarWorld, type AvatarWorldOptions, type ViewerAvatar} from './avatar-world';

export interface AvatarSceneOptions extends AvatarWorldOptions {
  size?:number;
  showNames?:boolean;
}
const pixel=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string)=>{
  ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
};

/**
 * Keep the complete creature, largest speech bubble, and name within a short or narrow source.
 * The world uses normalized coordinates; this is a renderer-only viewport projection.
 */
export function avatarPlacement(
  actor:Pick<ViewerAvatar,'x'>,
  viewport:{width:number;height:number},
  options:{size:number;showNames:boolean},
) {
  const width=Math.max(1,viewport.width),height=Math.max(1,viewport.height);
  const showNames=options.showNames && height>=32 && width>=36;
  const bottomReserve=showNames?32:Math.min(9,height*.25);
  const requested=Math.max(18,options.size);
  // Headroom covers a jump, a thought bubble and movement bob.
  const size=Math.min(requested,width/2.15,Math.max(.5,(height-bottomReserve-8)/1.55));
  const margin=size*1.06; // speech bubble is up to 112px wide on the 54px sprite grid
  const x=Math.max(margin,Math.min(width-margin,actor.x*width));
  const ground=height-bottomReserve;
  return {x,ground,size,showNames,margin};
}

/** No transport, timers, or global state; a scene owns exactly one RAF and canvas. */
export function createAvatarScene(root:HTMLElement,options:AvatarSceneOptions={}) {
  const world=createAvatarWorld(options);
  const canvas=document.createElement('canvas');
  canvas.dataset.avatarScene='true';
  canvas.setAttribute('aria-label','Viewer avatars');
  canvas.style.cssText='display:block;width:100%;height:100%;background:transparent;';
  root.append(canvas);
  const ctx=canvas.getContext('2d');
  let raf=0,disposed=false,last=0,width=0,height=0,dpr=1;
  let size=options.size??54;
  let showNames=options.showNames!==false;
  function resize() {
    const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);
    const scale=Math.min(window.devicePixelRatio||1,2);
    if(w===width&&h===height&&scale===dpr)return;
    width=w;height=h;dpr=scale;
    canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  }
  function drawCreature(actor:ViewerAvatar,t:number) {
    if(!ctx)return;
    const placement=avatarPlacement(actor,{width,height},{size,showNames});
    const {x,ground,showNames:drawNames}=placement;
    const s=placement.size;
    const lift=actor.hop*s*1.8;
    const bob=actor.activity==='wander'||actor.activity==='greet'?Math.sin(t*.016+actor.x*11)*2:0;
    const bottom=ground-lift-bob;
    ctx.save();
    // Contact shadow and environmental presence, without an opaque stage.
    ctx.globalAlpha=.26;ctx.fillStyle='#101c26';ctx.beginPath();
    ctx.ellipse(x,ground+2,s*.31*Math.max(.45,1-actor.hop),s*.065,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.translate(Math.round(x),Math.round(bottom));
    ctx.scale(s/54,s/54);
    // Shoes and ears, drawn on the same pixel grid as the body.
    pixel(ctx,-17,-7,14,7,'#2d3644');pixel(ctx,3,-7,14,7,'#2d3644');
    pixel(ctx,-20,-41,12,20,actor.color);pixel(ctx,8,-41,12,20,actor.color);
    pixel(ctx,-22,-34,44,31,actor.color);
    pixel(ctx,-18,-38,36,15,actor.color);
    pixel(ctx,-16,-27,32,15,'#f0e3ce');
    pixel(ctx,-11,-21,7,7,'#26313c');pixel(ctx,5,-21,7,7,'#26313c');
    pixel(ctx,-12,-14,5,3,'#eaa5a6');pixel(ctx,9,-14,5,3,'#eaa5a6');
    pixel(ctx,-3,-12,7,2,'#856e78');
    // Tiny hands respond to the current activity.
    const hand=actor.activity==='greet'?Math.sin(t*.014)*4:0;
    pixel(ctx,-25,-20,5,9,actor.color);pixel(ctx,20,-20-hand,5,9,actor.color);
    if(actor.activity==='rest'){
      ctx.strokeStyle='#dae5ee';ctx.lineWidth=2;ctx.font='11px monospace';
      ctx.fillStyle='#dae5ee';ctx.fillText('z',19,-41);
    }
    if(actor.thought){
      const label=actor.thought.slice(0,18);
      ctx.font='bold 10px system-ui';const w=Math.min(112,ctx.measureText(label).width+18);
      const bx=-w/2,by=-68;
      ctx.fillStyle='rgba(23,30,37,.90)';ctx.beginPath();ctx.roundRect(bx,by,w,20,7);ctx.fill();
      ctx.fillStyle='#f9ebde';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(label,0,by+10,w-8);
    }
    ctx.restore();
    if(drawNames){
      ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='top';
      ctx.shadowColor='rgba(0,0,0,.95)';ctx.shadowBlur=4;
      ctx.fillStyle='#f6f4ec';ctx.fillText(actor.name.slice(0,20),x,ground+9,Math.min(width-2,placement.margin*2));
      ctx.shadowBlur=0;
    }
  }
  function frame(time:number) {
    if(disposed)return;
    resize();
    if(last)world.step(Math.min(time-last,50));
    last=time;
    if(ctx){
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);
      for(const actor of world.snapshot())drawCreature(actor,time);
    }
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return {
    receive(message:DisplayMessage){world.receive(message);},
    removeMessage(messageId:string){world.removeMessage(messageId);},
    removeUser(target:{sourceId?:string;userId?:string;username?:string}){world.removeUser(target);},
    removeSource(sourceId:string){world.removeSource(sourceId);},
    configure(patch:AvatarSceneOptions){
      if(patch.size!==undefined)size=patch.size;
      if(patch.showNames!==undefined)showNames=patch.showNames;
      world.configure(patch);
    },
    clear(){world.clear();},
    snapshot:world.snapshot,
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);world.dispose();canvas.remove();},
  };
}
