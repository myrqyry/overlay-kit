export interface PreviewLiveGateOptions {
  preview:boolean;
  onEnter():void;
  onLeave():void;
}

/**
 * Studio previews should keep their fixtures until actual live content arrives.
 * A transport can be connected while a channel is offline or simply quiet.
 */
export function createPreviewLiveGate(options:PreviewLiveGateOptions){
  let live=false;
  return {
    contentArrived(){
      if(!options.preview||live)return;
      live=true;
      options.onEnter();
    },
    connectivityChanged(anyConnected:boolean){
      if(!options.preview||anyConnected||!live)return;
      live=false;
      options.onLeave();
    },
    isLive:()=>live,
  };
}
