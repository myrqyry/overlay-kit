import type {OverlayEditorView} from '../src/options';

/** Single transient popup, outside the scrolling tab strip. Hover never picks
 * a workspace; touch and keyboard have their own explicit access paths. */
export function createWorkspaceTabActions(root:HTMLElement,tabs:Record<OverlayEditorView,HTMLButtonElement>){
  const controller=new AbortController(),{signal}=controller;
  const groups=Array.from(root.querySelectorAll<HTMLElement>('.workspace-tab-action-group'));
  let active:OverlayEditorView|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>clearTimeout(timer);
  const close=()=>{
    cancel();active=null;root.hidden=true;
    for(const group of groups)group.hidden=true;
  };
  const position=()=>{
    if(!active)return;
    const box=tabs[active].getBoundingClientRect();
    const left=Math.max(4,Math.min(box.left,innerWidth-root.offsetWidth-4));
    root.style.left=left+'px';
    root.style.top=Math.min(box.bottom+3,Math.max(4,innerHeight-root.offsetHeight-4))+'px';
  };
  const open=(view:OverlayEditorView,focus=false)=>{
    cancel();active=view;
    for(const group of groups)group.hidden=group.dataset.view!==view;
    root.hidden=false;position();
    if(focus)root.querySelector<HTMLElement>('div[data-view='+view+'] input')?.focus();
  };
  const leave=()=>{
    cancel();
    timer=setTimeout(()=>{if(!root.contains(document.activeElement))close();},180);
  };
  for(const [view,tab] of Object.entries(tabs) as [OverlayEditorView,HTMLButtonElement][]){
    tab.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')open(view);},{signal});
    tab.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')leave();},{signal});
    tab.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')open(view);},{signal});
    tab.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'){event.preventDefault();open(view,true);}
      else if(event.key==='Escape')close();
    },{signal});
  }
  root.addEventListener('pointerenter',cancel,{signal});
  root.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')leave();},{signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){event.preventDefault();const tab=tabs[active];close();tab.focus();}
  },{signal});
  document.addEventListener('pointerdown',event=>{
    if(active&&!root.contains(event.target as Node)&&!tabs[active].contains(event.target as Node))close();
  },{signal});
  document.addEventListener('focusin',event=>{
    if(active&&!root.contains(event.target as Node)&&!tabs[active].contains(event.target as Node))close();
  },{signal});
  window.addEventListener('resize',close,{signal});
  tabs.wall.parentElement?.addEventListener('scroll',position,{signal});
  return {close,dispose(){close();controller.abort();}};
}
