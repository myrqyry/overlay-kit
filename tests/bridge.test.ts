import { describe, expect, it } from 'vitest';
import { createOverlayBridge, type ChannelLike } from '../src/bridge';

class FakeChannel implements ChannelLike {
  static opened = new Set<FakeChannel>();
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly name: string;
  closed = false;
  constructor(name: string) { this.name = name; FakeChannel.opened.add(this); }
  postMessage(data: unknown): void {
    for (const other of FakeChannel.opened) {
      if (other !== this && !other.closed && other.name === this.name) {
        other.onmessage?.({ data } as MessageEvent<unknown>);
      }
    }
  }
  close(): void { this.closed = true; FakeChannel.opened.delete(this); }
}
describe('same-origin event bridge', () => {
  it('delivers one validated event to multiple overlay consumers and tears down', () => {
    const messages: string[] = [];
    const make = (callback: (id: string) => void) =>
      createOverlayBridge('test-overlay', event => callback(event.message.id), FakeChannel);
    const producer = make(() => { throw new Error('Sender should not receive own message'); });
    const chat = make(id => { messages.push('chat:' + id); });
    const wall = make(id => { messages.push('wall:' + id); });
    producer.publish({ id: '42', timestamp: 0, user: { name: 'Tester', badges: [] }, parts: [] });
    expect(messages).toEqual(['chat:42', 'wall:42']);
    chat.dispose();
    producer.publish({ id: '43', timestamp: 0, user: { name: 'Tester', badges: [] }, parts: [] });
    expect(messages).toEqual(['chat:42', 'wall:42', 'wall:43']);
    wall.dispose();
    producer.dispose();
    expect(FakeChannel.opened.size).toBe(0);
  });
  it('rejects structurally corrupt nested emotes and badges before rendering', () => {
    const received: string[] = [];
    const bridge = createOverlayBridge('nested', e => received.push(e.message.id), FakeChannel);
    const adversary = new FakeChannel('nested');
    const base = { type: 'message', message: {
      id: 'm', timestamp: 20,
      user: { name: 'Viewer', badges: [] },
      parts: [{ type: 'emote', emote: {
        id: 'x', code: 'K', url: '/smile.svg', overlays: [], modifiers: [],
      } }],
    } };
    adversary.postMessage({ ...base, message: {
      ...base.message, parts: [{ type: 'emote', emote: {
        id: 'x', code: 'K', url: '/smile.svg', overlays: [null], modifiers: [],
      } }],
    } });
    adversary.postMessage({ ...base, message: { ...base.message,
      user: { name: 'Viewer', badges: [null] } } });
    expect(received).toEqual([]);
    bridge.dispose();
    adversary.close();
  });

  it('accepts bounded semantic badges without requiring a fake image URL',()=>{
    const received:string[]=[];
    const consumer=createOverlayBridge('semantic',e=>received.push(e.message.user.badges[0]?.text??''),FakeChannel);
    const producer=createOverlayBridge('semantic',()=>undefined,FakeChannel);
    producer.publish({id:'kick-role',timestamp:1,user:{name:'Gifter',badges:[
      {name:'Sub Gifter',provider:'kick',id:'sub_gifter',text:'GIFT 12'},
    ]},parts:[{type:'text',text:'hi'}]});
    expect(received).toEqual(['GIFT 12']);
    producer.dispose();consumer.dispose();
  });

  it('delivers normalized media GIF and mention parts through the same overlay bridge',()=>{
    const received:string[]=[];
    const viewer=createOverlayBridge('subscriber-gif',e=>received.push(JSON.stringify(e.message.parts)),FakeChannel);
    const sender=createOverlayBridge('subscriber-gif',()=>undefined,FakeChannel);
    const parts=[{type:'text' as const,text:'look '},
      {type:'mention' as const,text:'@Viewer',username:'viewer'},
      {type:'media' as const,text:'[GIF]',mediaType:'gif' as const,
        url:'https://media4.giphy.com/media/abc/giphy.gif?cid=keep&rid=giphy.gif',alt:'GIF'}];
    sender.publish({id:'gif',timestamp:11,user:{name:'Viewer',badges:[]},parts});
    expect(received).toEqual([JSON.stringify(parts)]);
    sender.dispose();viewer.dispose();
  });
  it('rejects malformed or unsafe media parts before forwarding to overlays',()=>{
    const received:string[]=[];
    const viewer=createOverlayBridge('unsafe-gif',e=>received.push(e.message.id),FakeChannel);
    const adversary=new FakeChannel('unsafe-gif');
    const base={type:'message',message:{
      id:'gif',timestamp:1,user:{name:'Viewer',badges:[]},
      parts:[{type:'media',text:'X',mediaType:'gif',url:'javascript:alert(1)'}],
    }};
    adversary.postMessage(base);
    adversary.postMessage({...base,message:{...base.message,parts:[{type:'media',text:'X',mediaType:'video',url:'https://example.com/x'}]}});
    adversary.postMessage({...base,message:{...base.message,parts:[{type:'media',text:'X',mediaType:'gif',url:''}]}});
    expect(received).toEqual([]);
    adversary.close();viewer.dispose();
  });

  it('ignores malformed and unrelated packets', () => {
    const received: string[] = [];
    const a = createOverlayBridge('safe', e => received.push(e.message.id), FakeChannel);
    const b = new FakeChannel('safe');
    b.postMessage({ type: 'message', message: { id: 'incomplete' } });
    b.postMessage({ type: 'disconnect' });
    b.postMessage({ type: 'message', message: { id: 'x', timestamp: 0, user: { name: 'T' }, parts: 'hi' } });
    expect(received).toEqual([]);
    a.dispose();
    b.close();
  });
});
