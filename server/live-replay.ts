import type {DisplayMessage} from '../src/chatbus';
import type {OverlayLiveEvent} from '../src/live';

export interface LiveReplayBuffer {
  apply(event:OverlayLiveEvent):void;
  snapshot():Array<{type:'message';message:DisplayMessage}>;
}

export function createLiveReplayBuffer(limit=50):LiveReplayBuffer {
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new RangeError('Live replay limit must be between 1 and 500');
  const messages=new Map<string,DisplayMessage>();
  const order:string[]=[];
  const remove=(id:string)=>{
    if(!messages.delete(id))return;
    const index=order.indexOf(id);
    if(index>=0)order.splice(index,1);
  };
  const removeWhere=(predicate:(message:DisplayMessage)=>boolean)=>{
    for(const id of [...order]){
      const message=messages.get(id);
      if(message&&predicate(message))remove(id);
    }
  };
  return {
    apply(event){
      switch(event.type){
        case 'message': {
          const id=event.message.id;
          if(!messages.has(id))order.push(id);
          messages.set(id,event.message);
          while(order.length>limit)remove(order[0]!);
          return;
        }
        case 'badges': {
          const message=messages.get(event.messageId);if(!message)return;
          messages.set(event.messageId,{...message,user:{...message.user,badges:[...event.badges]}});
          return;
        }
        case 'identity': {
          const message=messages.get(event.messageId);if(!message)return;
          messages.set(event.messageId,{...message,user:{...message.user,badges:[...event.badges],
            ...(event.namePaint?{namePaint:event.namePaint}:message.user.namePaint?{namePaint:message.user.namePaint}:{})}});
          return;
        }
        case 'delete':remove(event.messageId);return;
        case 'clear':
          if(event.sourceId)removeWhere(message=>message.sourceId===event.sourceId);
          else {messages.clear();order.length=0;}
          return;
        case 'user-clear': {
          const username=event.username?.toLowerCase();
          removeWhere(message=>(!event.sourceId||message.sourceId===event.sourceId)&&(
            Boolean(event.userId&&message.user.id===event.userId)||
            Boolean(username&&message.user.username?.toLowerCase()===username)
          ));
        }
      }
    },
    snapshot(){
      return order.flatMap(id=>{
        const message=messages.get(id);
        return message?[{type:'message' as const,message}]:[];
      });
    },
  };
}
