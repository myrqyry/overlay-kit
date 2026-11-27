/** Manages just this editor's hosted WebSocket subscription.
 * Does not send mutation requests to the globally shared upstream channel.
 */
export function createHostedPreviewSession(
  open: () => {dispose():void},
  onChange: (enabled:boolean)=>void,
) {
  let connection: {dispose():void}|null=null;
  return {
    get enabled(){return connection!==null;},
    connect(){
      if(connection)return;
      const next=open();
      connection=next;
      onChange(true);
    },
    disconnect(){
      if(!connection)return;
      const old=connection;
      connection=null;
      try{old.dispose();}finally{onChange(false);}
    },
    dispose(options?:{notify?:boolean}){
      if(connection){
        const old=connection;
        connection=null;
        try{old.dispose();}finally{if(options?.notify!==false)onChange(false);}
      }
    },
  };
}
