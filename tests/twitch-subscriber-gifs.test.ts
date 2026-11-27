import {describe,expect,it} from 'vitest';
import {normalizeTwitchIrcFrame,parseTwitchIrcLine} from '@myrqyry/chatbus';
import {fromChatbus} from '../src/chatbus';
import {createChatMessageElement} from '../src/renderers';

const gifUrl='https://media4.giphy.com/media/joSNxeswxuc74Juo8X/giphy.gif?cid=095d7a5d&ep=v1_gifs_trending&rid=giphy.gif&ct=g';
const gifLabel='[Y A Y Yes GIF by Djemilah Birnie]';
const normalize=(body:string,tag:string,emotes='')=>{
  const frame=parseTwitchIrcLine(
    '@id=gif-message;user-id=123;display-name=Viewer;emotes='+emotes+';gifs='+tag+
    ' :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #example :'+body,
  );
  expect(frame).not.toBeNull();
  return normalizeTwitchIrcFrame(frame!,{channel:'example',fallbackId:'unused'});
};

describe('Twitch higher-tier subscriber GIFs from the anonymous IRC gifs tag',()=>{
  it('preserves the full original GIPHY URL, sender, alt text and span in Chat',()=>{
    const event=normalize(gifLabel,'0-33|joSNxeswxuc74Juo8X|'+gifUrl);
    expect(event?.type).toBe('message');
    expect(event?.message?.fragments).toEqual([
      {type:'media',text:gifLabel,mediaType:'gif',id:'joSNxeswxuc74Juo8X',
        url:gifUrl,alt:gifLabel},
    ]);
    const display=fromChatbus(event!.message!)!;
    expect(display.parts).toMatchObject([{type:'media',mediaType:'gif',url:gifUrl,alt:gifLabel}]);
    const view=createChatMessageElement(display);
    const img=view.querySelector<HTMLImageElement>('[data-media-type="gif"]');
    expect(img?.getAttribute('src')).toBe(gifUrl);
    expect(img?.alt).toBe(gifLabel);
    expect(view.querySelector('[data-username]')?.textContent).toBe('Viewer');
    expect(img?.style.maxWidth).not.toBe('');
  });
  it('keeps ordinary text and native emotes in original order around the GIF',()=>{
    const text='Hello '+gifLabel+' Kappa!';
    const start=text.indexOf(gifLabel);
    const emojiStart=text.indexOf('Kappa');
    const event=normalize(text,
      start+'-'+(start+gifLabel.length-1)+'|joSNxeswxuc74Juo8X|'+gifUrl,
      '25:'+emojiStart+'-'+(emojiStart+4));
    const types=event?.message?.fragments.map(part=>part.type);
    expect(types).toEqual(['text','media','text','emote','text']);
    expect(event?.message?.fragments[0]).toMatchObject({text:'Hello '});
    expect(event?.message?.fragments[2]).toMatchObject({text:' '});
    expect(event?.message?.fragments[3]).toMatchObject({type:'emote',text:'Kappa'});
    expect(event?.message?.fragments[4]).toMatchObject({text:'!'});
  });
  it('accepts multiple non-overlapping GIFs without splitting URL query commas',()=>{
    const text='AB cd EFG';
    const urlOne='https://media1.giphy.com/media/abc/giphy.gif?x=1,2&y=3';
    const urlTwo='https://i.giphy.com/media/def/giphy.gif?x=42';
    const event=normalize(text,'0-1|abc|'+urlOne+',6-8|def|'+urlTwo);
    expect(event?.message?.fragments).toEqual([
      {type:'media',text:'AB',mediaType:'gif',id:'abc',url:urlOne,alt:'AB'},
      {type:'text',text:' cd '},
      {type:'media',text:'EFG',mediaType:'gif',id:'def',url:urlTwo,alt:'EFG'},
    ]);
  });
  it('ignores malformed, overlapping, out-of-range or unsafe tag entries without losing text',()=>{
    const text='hello world';
    const valid='0-4|safe|https://media1.giphy.com/media/safe/giphy.gif';
    for(const bad of [
      'bogus','9-4|x|'+gifUrl,'0-9999|x|'+gifUrl,
      '0-4|evil|https://evil.example/x.gif','0-4|scheme|javascript:alert(1)',
      '0-4|scheme|http://media.giphy.com/x.gif','0-4|evil|https://giphy.com.evil.example/x.gif',
    ]){
      const result=normalize(text,bad);
      expect(result?.message?.fragments).toEqual([{type:'text',text}]);
    }
    expect(normalize(text,valid+',2-5|overlap|'+gifUrl)?.message?.fragments)
      .toMatchObject([{type:'media',text:'hello'},{type:'text',text:' world'}]);
  });
  it('adjusts CTCP ACTION offsets to display the GIF instead of a broken range',()=>{
    const label='[GIF]';
    const text='\x01ACTION '+label+'\x01';
    const start=8,end=start+label.length-1;
    const event=normalize(text,start+'-'+end+'|gif|'+gifUrl);
    expect(event?.message?.text).toBe(label);
    expect(event?.message?.fragments).toMatchObject([
      {type:'media',text:label,mediaType:'gif',url:gifUrl},
    ]);
    expect(event?.message?.traits?.messageType).toBe('action');
  });
  it('treats a user-pasted GIPHY link without a verified tag as ordinary text',()=>{
    const text='watch '+gifUrl;
    expect(normalize(text,'')?.message?.fragments).toEqual([{type:'text',text}]);
  });
});
