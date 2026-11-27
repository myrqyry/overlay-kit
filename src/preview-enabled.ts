import type {OverlayEditorView} from './options';

/** Only the two primary overlays run on first visit. A saved switch wins. */
export const DEFAULT_PREVIEW_ENABLED: Readonly<Record<OverlayEditorView,boolean>>=Object.freeze({
  wall:true,chat:true,avatars:false,events:false,
});
const VIEWS:readonly OverlayEditorView[]=['wall','chat','avatars','events'];
export function restorePreviewEnabled(raw:string|null):Record<OverlayEditorView,boolean>{
  const enabled={...DEFAULT_PREVIEW_ENABLED};
  try{
    const saved=raw===null?null:JSON.parse(raw) as unknown;
    if(saved!==null&&typeof saved==='object'&&!Array.isArray(saved)){
      const values=saved as Partial<Record<OverlayEditorView,unknown>>;
      for(const view of VIEWS){
        if(typeof values[view]==='boolean')enabled[view]=values[view];
      }
    }
  }catch{/* Malformed data or blocked storage leaves defaults intact. */}
  return enabled;
}
