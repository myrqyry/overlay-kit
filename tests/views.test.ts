import { describe, expect, it, vi } from 'vitest';
import { createChatFeed, createEmoteWall } from '../src/views';
import type { DisplayMessage } from '../src/chatbus';

const message: DisplayMessage = {
  id: 'hello', timestamp: 1700,
  user: { name: 'Viewer', badges: [] },
  parts: [
    { type: 'text', text: 'Hi ' },
    { type: 'emote', emote: { id: 'k', code: 'Kappa', url: '/k.png',
      overlays: [{ code: 'hat', url: '/hat.png' }], modifiers: [] } },
    { type: 'text', text: ' ' },
    { type: 'emote', emote: { id: 'm', code: 'Hey', url: '/m.png', overlays: [], modifiers: [] } },
  ],
};
describe('shared scene with different overlay views', () => {
  it('routes one message into one chat entry and two emote entities with no nested duplication', () => {
    const chatRoot = document.createElement('div');
    const wallRoot = document.createElement('div');
    const feed = createChatFeed(chatRoot, { maxActive: 3, ttlMs: 100_000 });
    const wall = createEmoteWall(wallRoot, { maxActive: 3, ttlMs: 100_000, size: 44, motion: 'float' });
    expect(feed.receive(message)).toBe(true);
    expect(wall.receive(message)).toBe(2);
    expect(chatRoot.querySelectorAll('.overlay-chat-message')).toHaveLength(1);
    expect(wallRoot.querySelectorAll('[data-wall-item]')).toHaveLength(2);
    expect(wallRoot.querySelectorAll('img')).toHaveLength(3);
    expect(wallRoot.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
    expect(wallRoot.querySelectorAll('[data-motion="float"]')).toHaveLength(2);
    wall.dispose();
    feed.dispose();
    expect(wallRoot.childElementCount).toBe(0);
    expect(chatRoot.childElementCount).toBe(0);
  });

  it('releases wall size observers on expiration, eviction, and dispose', () => {
    const disconnect=vi.fn();
    const observe=vi.fn();
    const original=globalThis.ResizeObserver;
    class FakeResizeObserver {
      observe=observe;
      disconnect=disconnect;
      unobserve=vi.fn();
    }
    vi.stubGlobal('ResizeObserver',FakeResizeObserver);
    try {
      const root=document.createElement('div');
      const wall=createEmoteWall(root,{maxActive:1});
      wall.receive(message);
      // Two entities created; the first evicted as maxActive=1.
      expect(observe).toHaveBeenCalledTimes(4);
      expect(disconnect).toHaveBeenCalledTimes(1);
      wall.dispose();
      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(root.childElementCount).toBe(0);
    } finally {
      vi.stubGlobal('ResizeObserver',original);
      vi.unstubAllGlobals();
    }
  });

  it('accepts custom Stagehand-style renderers and disposes animations with each entity', () => {
    const root = document.createElement('div');
    const destroyed: string[] = [];
    const wall = createEmoteWall(root, {
      maxActive: 1, ttlMs: 40_000,
      renderArtwork(art) {
        const element = document.createElement('span');
        element.textContent = 'custom:' + art.code;
        return { element, dispose: () => { destroyed.push(art.code); } };
      },
    });
    wall.receive(message);
    expect(root.textContent).toBe('custom:Hey');
    expect(destroyed).toEqual(['Kappa']);
    wall.dispose();
    expect(destroyed).toEqual(['Kappa', 'Hey']);

    const chatRoot = document.createElement('div');
    let disposed = 0;
    const chat = createChatFeed(chatRoot, {
      renderMessage(msg) {
        const element = document.createElement('div');
        element.dataset.customMessage = msg.id;
        return { element, dispose: () => { disposed++; } };
      },
    });
    chat.receive(message);
    expect(chatRoot.querySelector('[data-custom-message="hello"]')).not.toBeNull();
    chat.dispose();
    expect(disposed).toBe(1);
  });

  it('reconfigures admission and a wall animation without replacing an existing item', () => {
    const root = document.createElement('div');
    const wall = createEmoteWall(root, { maxActive: 1, ttlMs: 60_000, motion: 'float' });
    expect(wall.receive(message)).toBe(2);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(1);
    wall.configure({ motion: 'bounce', maxActive: 2 });
    const next = { ...message, id: 'next' };
    expect(wall.receive(next)).toBe(2);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(2);
    expect(root.querySelectorAll('[data-motion="bounce"]')).toHaveLength(2);
    wall.dispose();
  });
});

describe('real appearance settings', () => {
  it('applies a controlled chat presentation without injecting CSS or markup', async () => {
    const { createChatMessageElement } = await import('../src/renderers');
    const el = createChatMessageElement(message, {
      fontFamily: 'mono', stroke: 2, shadow: 'strong',
      lineHeight: 1.8, backgroundAlpha: 20, radius: 2,
      showNames: false, showTimestamp: true, enter: 'slide',
    });
    expect(el.style.fontFamily).toContain('monospace');
    expect(el.style.webkitTextStrokeWidth).toBe('4px');
    expect(el.style.webkitTextStrokeColor).toBe('rgba(12, 15, 21, 0.8)');
    expect(el.style.paintOrder).toBe('stroke fill');
    expect(el.style.textShadow).toBeTruthy();
    expect(el.style.lineHeight).toBe('1.8');
    expect(el.style.background).toContain('0.2');
    expect(el.style.borderRadius).toBe('2px');
    expect(el.dataset.enter).toBe('slide');
    expect(el.querySelector('time')).not.toBeNull();
    expect(el.querySelector('[data-username]')).toBeNull();
  });

  it('uses wall emote size as height without placing wide artwork in a square wrapper', () => {
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{size:68,motion:'still'});
    wall.receive({id:'wide',timestamp:1,user:{name:'Viewer',badges:[]},
      parts:[{type:'emote',emote:{
        id:'wide',code:'Panorama',url:'/panorama.svg',
        overlays:[{code:'overlay',url:'/overlay.svg'}],modifiers:[],
      }}]});
    const item=root.querySelector<HTMLElement>('[data-wall-item]')!;
    const art=item.querySelector<HTMLElement>('.overlay-emote')!;
    expect(item.style.height).toBe('68px');
    expect(item.style.width).toBe('max-content');
    expect(art.style.height).toBe('68px');
    expect(art.style.width).toBe('max-content');
    expect(art.querySelector('img')!.style.width).toBe('auto');
    wall.dispose();
  });

  it('applies wall speed/distance/spawn-zone to physical layout and CSS variables', () => {
    const root = document.createElement('div');
    const wall = createEmoteWall(root, {
      motion: 'float', wallSpeed: 1.5, wallDistance: 62, spawn: 'bottom', size: 52,
    });
    wall.receive(message);
    const item = root.querySelector<HTMLElement>('[data-wall-item]')!;
    expect(item.style.getPropertyValue('--wall-distance')).toBe('62px');
    expect(item.style.getPropertyValue('--wall-period')).toBe('4.666666666666667s');
    expect(parseFloat(item.style.top)).toBeGreaterThanOrEqual(70);
    expect(parseFloat(item.style.top)).toBeLessThanOrEqual(95);
    wall.dispose();
  });
});
