import {describe,it,expect} from 'vitest';
import {createLiveReplayBuffer} from '../server/live-replay';
import type {DisplayMessage} from '../src/chatbus';

const message=(id:string,sourceId='kick:demo',user='viewer'):DisplayMessage=>({
  id,timestamp:Number(id.replace(/\D/g,''))||1,sourceId,platform:'kick',channelName:'demo',
  user:{id:user,username:user,name:user,badges:[]},parts:[{type:'text',text:id}],
});

describe('live replay snapshot',()=>{
  it('replays current messages in insertion order and applies identity mutations',()=>{
    const replay=createLiveReplayBuffer(4);
    replay.apply({type:'message',message:message('m1')});
    replay.apply({type:'message',message:message('m2')});
    replay.apply({type:'identity',messageId:'m1',badges:[{name:'SUB',text:'SUB 3'}],namePaint:{id:'paint',provider:'7tv'}});
    const snapshot=replay.snapshot();
    expect(snapshot.map(event=>event.message.id)).toEqual(['m1','m2']);
    expect(snapshot[0].message.user).toMatchObject({badges:[{name:'SUB',text:'SUB 3'}],namePaint:{id:'paint'}});
  });

  it('applies delete, user/source clears, full clears and a hard size bound',()=>{
    const replay=createLiveReplayBuffer(2);
    replay.apply({type:'message',message:message('m1','kick:a','u1')});
    replay.apply({type:'message',message:message('m2','kick:a','u2')});
    replay.apply({type:'message',message:message('m3','kick:b','u1')});
    expect(replay.snapshot().map(event=>event.message.id)).toEqual(['m2','m3']);
    replay.apply({type:'user-clear',sourceId:'kick:a',userId:'u2'});
    expect(replay.snapshot().map(event=>event.message.id)).toEqual(['m3']);
    replay.apply({type:'clear',sourceId:'kick:b'});
    expect(replay.snapshot()).toEqual([]);
    replay.apply({type:'message',message:message('m4')});
    replay.apply({type:'clear'});
    expect(replay.snapshot()).toEqual([]);
  });
});
