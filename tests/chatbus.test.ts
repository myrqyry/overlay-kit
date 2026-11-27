import { describe, expect, it } from 'vitest';
import { fromChatbus } from '../src/chatbus';
import { extractEmotes, createEmoteArtwork, createChatMessageElement } from '../src/renderers';

describe('Chatbus contract and safe overlay views', () => {
  const fixture = {
    id: 'msg-1', timestamp: 1700,
    user: { username: 'tester', displayName: '<Tester>', color: '#bada55',
      badges: [{ id: 'mod', name: 'Moderator', url: 'https://cdn.example/mod.png' }] },
    fragments: [
      { type: 'text' as const, text: '<img src=x onerror=alert(1)>' },
      { type: 'emote' as const, text: 'Kappa',
        emote: { id: '25', code: 'Kappa', url: 'https://cdn.example/base.webp', provider: 'twitch' },
        overlays: [{ id: 'hat', code: 'Hat', url: 'https://cdn.example/hat.webp' }],
        modifiers: [{ id: 'fx', code: 'Rainbow', url: 'https://cdn.example/fx.webp', modifierFlags: 2049 }]
      },
    ],
  };
  it('preserves emote stacks and modifiers without reparsing message text', () => {
    const message = fromChatbus(fixture);
    expect(message.id).toBe('msg-1');
    const emotes = extractEmotes(message);
    expect(emotes).toEqual([{ id: '25', code: 'Kappa',
      url: 'https://cdn.example/base.webp',provider:'twitch',
      overlays: [{ code: 'Hat', url: 'https://cdn.example/hat.webp' }],
      modifiers: [{ code: 'Rainbow', flags: 2049 }],
    }]);
    expect(message.parts[0]).toEqual({ type: 'text', text: '<img src=x onerror=alert(1)>' });
  });

  it('sizes emotes by height, leaving base image width unconstrained for panoramic assets', () => {
    const art=createEmoteArtwork({id:'wide',code:'Wide',url:'/wide.svg',
      overlays:[{code:'Hat',url:'/hat.svg'}],modifiers:[]},48);
    const [base,overlay]=Array.from(art.querySelectorAll('img'));
    expect(art.style.height).toBe('48px');
    expect(art.style.width).toBe('max-content');
    expect(base!.style.height).toBe('100%');
    expect(base!.style.width).toBe('auto');
    expect(base!.style.maxWidth).toBe('none');
    expect(overlay!.style.position).toBe('absolute');
    expect(overlay!.style.height).toBe('100%');
    expect(overlay!.style.width).toBe('100%');
    expect(overlay!.style.objectFit).toBe('contain');
    const chat=createChatMessageElement({id:'wide',timestamp:1,
      user:{name:'Viewer',badges:[]},parts:[{type:'emote',emote:{
        id:'wide',code:'Wide',url:'/wide.svg',overlays:[],modifiers:[],
      }}]}, {emoteSize:72});
    expect(chat.querySelector<HTMLElement>('.overlay-emote')?.style.height).toBe('72px');
    expect(chat.querySelector<HTMLImageElement>('.overlay-emote img')?.style.width).toBe('auto');
    const unicode=createEmoteArtwork({id:'u',code:'😀',url:'',provider:'unicode-emoji',emojiService:'twemoji',overlays:[],modifiers:[]},160);
    expect(unicode.style.fontSize).toContain('--chat-emote-height-limit');
  });

  it('renders text via textContent, not HTML, with badges and stacked emote art', () => {
    const message = fromChatbus(fixture);
    const row = createChatMessageElement(message, { showBadges: true, fontSize: 21, emoteSize: 42 });
    expect(row.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(row.querySelector('[onerror]')).toBeNull();
    expect(row.querySelectorAll('img')).toHaveLength(3);
    expect(row.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
    expect(row.querySelector('[data-username]')?.textContent).toBe('<Tester>');
    expect(row.style.fontSize).toBe('21px');
    const artwork = createEmoteArtwork(extractEmotes(message)[0]!, 35);
    expect(artwork.querySelectorAll('img')).toHaveLength(2);
    expect(artwork.dataset.modifiers).toBe('Rainbow');
  });

  it('renders a compact service badge from normalized platform identity', () => {
    const row=createChatMessageElement(fromChatbus({...fixture,platform:'youtube'}));
    const badge=row.querySelector<HTMLElement>('.overlay-service-badge');
    expect(badge?.dataset.platform).toBe('youtube');
    expect(badge?.getAttribute('aria-label')).toBe('YouTube');
    expect(badge?.querySelector('svg')).not.toBeNull();
  });

  it('uses an original generic Kick service letterform, not copied wordmark geometry', () => {
    const row=createChatMessageElement(fromChatbus({...fixture,platform:'kick'}),{radius:40});
    const badge=row.querySelector<HTMLElement>('.overlay-service-badge');
    const svg=badge?.querySelector('svg');
    const path=svg?.querySelector('path');
    expect(badge?.dataset.platform).toBe('kick');
    expect(badge?.style.borderRadius).toBe('50%');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(path?.getAttribute('d')).toBe('M6 4h3v7l7-7h4l-8 8 8 8h-4l-7-7v7H6Z');
  });

  it('links service badge rounding to bubble corners, reaching a circle at maximum', () => {
    const message=fromChatbus({...fixture,platform:'twitch'});
    const radius=(value:number)=>createChatMessageElement(message,{radius:value})
      .querySelector<HTMLElement>('.overlay-service-badge')?.style.borderRadius;
    expect(radius(0)).toBe('0%');
    expect(radius(20)).toBe('25%');
    expect(radius(40)).toBe('50%');
  });

  it('keeps standalone FFZ modifier art and native cheermotes in the shared presentation', () => {
    const display = fromChatbus({
      id: 'modifier', timestamp: 10, user: { username: 'u' },
      fragments: [
        { type: 'modifier', text: 'ffzRainbow',
          emote: { id: 'ffz', code: 'ffzRainbow', url: 'https://example.com/rainbow.png' } },
        { type: 'text', text: ' ' },
        { type: 'cheermote', text: 'Cheer100',
          emote: { id: 'cheer', code: 'Cheer100', url: 'https://example.com/cheer.gif' } },
      ],
    });
    expect(extractEmotes(display).map(e => e.code)).toEqual(['ffzRainbow', 'Cheer100']);
  });

  it('rejects script image URLs rather than forwarding them into DOM', () => {
    const art = createEmoteArtwork({
      id: 'x', code: 'bad', url: 'javascript:alert(1)',
      overlays: [{ code: 'bad', url: 'data:text/html,evil' }], modifiers: [],
    }, 32);
    expect(art.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('additional Chatbus fragment coverage without provider-side reparsing',()=>{
 it('preserves mention identity, media asset, emote provider, and bits metadata',()=>{
  const message=fromChatbus({
    id:'rich',timestamp:80,platform:'kick',channelName:'cool-channel',
    traits:{highlighted:true,firstMessage:true},
    reply:{parentMessageId:'parent',parentUsername:'someone'},
    user:{username:'test',roles:['subscriber']},
    fragments:[
      {type:'mention',text:'@Someone',username:'someone',userId:'id-2'},
      {type:'media',text:'a GIF',mediaType:'gif',url:'https://example.net/cat.gif',alt:'Cat'},
      {type:'cheermote',text:'Cheer100',bits:100,emote:{id:'bits',code:'Cheer100',
        url:'https://example.net/cheer.gif',provider:'twitch-cheer',animated:true}},
      {type:'unknown',text:'fallback'},
    ],
  });
  expect(message).toMatchObject({platform:'kick',channelName:'cool-channel',
    traits:{highlighted:true,firstMessage:true},
    reply:{parentMessageId:'parent'},user:{roles:['subscriber']},
    parts:[
      {type:'mention',text:'@Someone',userId:'id-2'},
      {type:'media',url:'https://example.net/cat.gif',mediaType:'gif',alt:'Cat'},
      {type:'emote',bits:100,emote:{provider:'twitch-cheer',animated:true}},
      {type:'text',text:'fallback'},
    ],
  });
  const el=createChatMessageElement(message);
  expect(el.querySelector('[data-mention]')?.textContent).toBe('@Someone');
  expect(el.querySelector('[data-media-type="gif"]')?.getAttribute('src')).toBe('https://example.net/cat.gif');
  expect(el.textContent).toContain('fallback');
  expect(el.querySelector('[data-username]')?.textContent).toBe('test');
 });
});
