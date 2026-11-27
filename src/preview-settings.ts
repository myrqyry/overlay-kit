import type {OverlayOptions} from './options';

export type PreviewFrameUpdate='reload'|'update';

/** Keep studio preview documents alive after their first load. Settings travel
 * over same-origin postMessage so Vite/live sockets and current overlay state
 * are not torn down for every control change. */
export function updatePreviewFrame(
  frame:HTMLIFrameElement,
  url:string,
  settings:OverlayOptions,
  origin:string,
  forceReload=false,
):PreviewFrameUpdate {
  if(forceReload||frame.dataset.previewReady!=='true'||!frame.contentWindow){
    frame.dataset.previewReady='false';
    frame.src=url;
    return 'reload';
  }
  frame.contentWindow.postMessage({type:'overlay-kit-preview-settings',settings},origin);
  return 'update';
}


/** Navigate away from the runtime instead of concealing a running iframe.
 * The old document's pagehide disposes the renderer and sockets. */
export function suspendPreviewFrame(frame:HTMLIFrameElement):void {
  frame.dataset.previewReady='false';
  if(frame.src!=='about:blank')frame.src='about:blank';
}
