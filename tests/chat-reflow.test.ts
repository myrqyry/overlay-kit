import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatFeed } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const message = (id: string): DisplayMessage => ({
  id, timestamp: 1700, user: { name: id, badges: [] },
  parts: [{ type: 'text', text: id }],
});

function environment(root: HTMLElement) {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const cancelAnimation = vi.fn();
  const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => ({ cancel: cancelAnimation }));
  const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const index = Array.from(root.children).indexOf(this);
      // Model physical order, not DOM order: top anchors use a reversed
      // column with the newest row above older entries. Expiry of an oldest
      // row at the bottom must not shift the newer rows above it.
      const top = index < 0 ? 0
        : root.style.flexDirection === 'column-reverse'
          ? (root.children.length - index - 1) * 20
          : 200 - 20 * (root.children.length - index);
      return { x:0, y:top, top, left:0, bottom:top + 20, right:240,
        width:240, height:20, toJSON:() => ({}) };
    });
  const nativeAnimate = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  return {
    animate, measure, cancelAnimation, cancelFrame,
    flush() { const tasks = [...frames.values()]; frames.clear(); for (const fn of tasks) fn(0); },
    pending:() => frames.size,
    restore() { HTMLElement.prototype.animate = nativeAnimate; },
  };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('optional chat row reflow', () => {
  it('persists a disabled-by-default smooth-reflow setting and duration through URLs and presets', () => {
    expect(DEFAULT_OPTIONS.smoothReflow).toBe(false);
    const settings = normalizeOptions({ ...DEFAULT_OPTIONS, smoothReflow:true, reflowMs:360 });
    expect(settings.smoothReflow).toBe(true);
    expect(settings.reflowMs).toBe(360);
    expect(readOptions('?' + writeOptions(settings))).toEqual(settings);
    expect(normalizeOptions({ reflowMs:99_999 }).reflowMs).toBeLessThanOrEqual(1000);
  });

  it('animates existing rows with independent translate rather than overwriting entrance transform', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:true, reflowMs:240 });
      chat.receive(message('a'));
      env.flush();
      expect(env.animate).not.toHaveBeenCalled();
      chat.receive(message('b'));
      env.flush();
      expect(env.animate).toHaveBeenCalledTimes(1);
      const [frames, options] = env.animate.mock.calls[0]!;
      expect(frames).toEqual([{ translate:'0px 20px' }, { translate:'0 0px' }]);
      expect(options).toMatchObject({ duration:240, fill:'none', easing:'cubic-bezier(.19,.76,.24,1)' });
      expect(root.firstElementChild?.getAttribute('data-enter')).toBe('rise');
      chat.removeMessage('b');
      env.flush();
      expect(env.cancelAnimation).toHaveBeenCalled();
      expect(env.animate).toHaveBeenCalledTimes(2);
      expect(env.animate.mock.calls[1]![0]).toEqual([{ translate:'0px -20px' }, { translate:'0 0px' }]);
      chat.dispose();
    } finally { env.restore(); }
  });

  it('coalesces a burst to one before/after geometry pass and one animation per surviving row', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:true });
      chat.receive(message('a')); env.flush();
      env.measure.mockClear();
      chat.receive(message('b'));
      chat.receive(message('c'));
      chat.receive(message('d'));
      expect(env.pending()).toBe(1);
      env.flush();
      expect(env.animate).toHaveBeenCalledTimes(1);
      expect(env.animate.mock.calls[0]![0]).toEqual([{ translate:'0px 60px' }, { translate:'0 0px' }]);
      expect(env.measure).toHaveBeenCalledTimes(2);
      chat.dispose();
    } finally { env.restore(); }
  });

  it('does nothing when disabled, and stops pending animations and frames on disable/dispose', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:false });
      chat.receive(message('a')); chat.receive(message('b')); env.flush();
      expect(env.measure).not.toHaveBeenCalled();
      expect(env.animate).not.toHaveBeenCalled();
      chat.configure({ smoothReflow:true });
      chat.receive(message('c')); env.flush();
      expect(env.animate).toHaveBeenCalled();
      chat.receive(message('d'));
      chat.configure({ smoothReflow:false });
      expect(env.pending()).toBe(0);
      expect(env.cancelAnimation).toHaveBeenCalled();
      expect(env.cancelFrame).toHaveBeenCalled();
      chat.dispose();
    } finally { env.restore(); }
  });

  it('does not measure or animate under reduced-motion preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches:true }));
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:true });
      chat.receive(message('a')); chat.receive(message('b')); env.flush();
      expect(env.measure).not.toHaveBeenCalled();
      expect(env.animate).not.toHaveBeenCalled();
      chat.dispose();
    } finally { env.restore(); }
  });

  it('keeps chat usable if an older browser cannot animate CSS translate', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      env.animate.mockImplementation(() => { throw new Error('unsupported translate'); });
      const chat = createChatFeed(root, { smoothReflow:true });
      expect(chat.receive(message('a'))).toBe(true); env.flush();
      expect(chat.receive(message('b'))).toBe(true);
      expect(() => env.flush()).not.toThrow();
      expect(root.children).toHaveLength(2);
      chat.dispose();
    } finally { env.restore(); }
  });

  it('clears rows without scheduling a new transition and can animate afterward', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:true });
      chat.receive(message('a')); env.flush();
      chat.receive(message('b'));
      chat.clear();
      expect(root.children).toHaveLength(0);
      expect(env.pending()).toBe(0);
      chat.receive(message('c')); env.flush();
      chat.receive(message('d')); env.flush();
      expect(env.animate).toHaveBeenCalledTimes(1);
      chat.dispose();
      expect(env.pending()).toBe(0);
    } finally { env.restore(); }
  });

  it('does not move top-anchored newer rows when the oldest row expires below them', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, { smoothReflow:true, ttlMs:100, exit:'none', vertical:'top' });
      chat.receive(message('a')); env.flush();
      vi.advanceTimersByTime(50);
      chat.receive(message('b')); env.flush();
      env.animate.mockClear();
      vi.advanceTimersByTime(50);
      env.flush();
      expect(root.querySelectorAll('.overlay-chat-message')).toHaveLength(1);
      expect(root.querySelector('.overlay-chat-message')?.getAttribute('data-message-id')).toBe('b');
      // The oldest expired at the bottom; b remains anchored at top:0.
      expect(env.animate).not.toHaveBeenCalled();
      chat.dispose();
    } finally { env.restore(); }
  });

  it('reflows older rows upward when a newest top-anchored row is removed', () => {
    const root = document.createElement('div');
    const env = environment(root);
    try {
      const chat = createChatFeed(root, {
        smoothReflow:true,ttlMs:120000,deleteEffect:'none',vertical:'top',
      });
      chat.receive(message('a')); env.flush();
      chat.receive(message('b')); env.flush();
      env.animate.mockClear();
      expect(chat.removeMessage('b')).toBe(true);
      env.flush();
      expect(root.querySelectorAll('.overlay-chat-message')).toHaveLength(1);
      expect(root.querySelector('.overlay-chat-message')?.getAttribute('data-message-id')).toBe('a');
      expect(env.animate).toHaveBeenCalledTimes(1);
      expect(env.animate.mock.calls[0]![0]).toEqual([
        { translate:'0px 20px' }, { translate:'0 0px' },
      ]);
      chat.dispose();
    } finally { env.restore(); }
  });
});
