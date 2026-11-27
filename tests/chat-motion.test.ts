import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScene } from '../src/scene';
import { createChatFeed } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const message = (id: string): DisplayMessage => ({
  id, timestamp: 1700, user: { name: 'Viewer', badges: [] },
  parts: [{ type: 'text', text: 'Message ' + id }],
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('compositor-friendly chat lifecycle', () => {
  it('retires expired items from the logical scene before asynchronous visual exit', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    let completeExit: (() => void) | undefined;
    const clean = vi.fn();
    const cancel = vi.fn();
    const scene = createScene<string>({
      root, ttlMs: 100, maxActive: 1,
      render(value) {
        const element = document.createElement('span');
        element.textContent = value;
        return {
          element,
          dispose: clean,
          exit(done: () => void) { completeExit = done; return cancel; },
        };
      },
    });
    expect(scene.emit({ id: 'first', value: 'one' })).toBe(true);
    vi.advanceTimersByTime(100);
    expect(scene.snapshot()).toEqual([]);
    expect(root.textContent).toBe('one');
    expect(scene.emit({ id: 'second', value: 'two' })).toBe(true);
    completeExit?.();
    expect(root.textContent).toBe('two');
    expect(clean).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    scene.dispose();
    expect(clean).toHaveBeenCalledTimes(2);
  });

  it('deletes moderated outgoing items immediately and bounds queued exit elements', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    let canceled = 0;
    const scene = createScene<string>({
      root, maxActive: 2, ttlMs: 20,
      render(value) {
        const element = document.createElement('span'); element.textContent = value;
        return { element, exit: (_done: () => void) => () => { canceled++; } };
      },
    });
    for (const id of ['a', 'b']) scene.emit({ id, value: id });
    vi.advanceTimersByTime(20);
    expect(root.textContent).toBe('ab');
    expect(scene.remove('a')).toBe(true);
    expect(root.textContent).toBe('b');
    for (const id of ['c', 'd', 'e']) {
      scene.emit({ id, value: id });
      vi.advanceTimersByTime(20);
    }
    expect(root.childElementCount).toBeLessThanOrEqual(2);
    scene.clear();
    expect(root.childElementCount).toBe(0);
    expect(canceled).toBeGreaterThanOrEqual(3);
    scene.dispose();
  });

  it('offers new entry/exit settings in validated URLs and presets', () => {
    const options = normalizeOptions({
      ...DEFAULT_OPTIONS, enter: 'pop', exit: 'slide-left',
      enterMs: 460, exitMs: 240,
    });
    expect(options.enter).toBe('pop');
    expect(options.exit).toBe('slide-left');
    expect(readOptions('?' + writeOptions(options))).toEqual(options);
    expect(normalizeOptions({ enter: 'width-expand', exit: 'height-collapse' }).enter)
      .toBe(DEFAULT_OPTIONS.enter);
    expect(normalizeOptions({ exitMs: 9999 }).exitMs).toBeLessThanOrEqual(1000);
  });

  it('animates expiry while preserving the occupied chat slot and immediately handles moderation', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const chat = createChatFeed(root, { ttlMs: 100, enter: 'pop', exit: 'sink', exitMs: 240 });
    chat.receive(message('first'));
    const row = root.firstElementChild as HTMLElement;
    expect(row.dataset.enter).toBe('pop');
    expect(row.dataset.exit).toBe('sink');
    vi.advanceTimersByTime(100);
    expect(chat.snapshot()).toHaveLength(0);
    expect(root.firstElementChild).toBe(row);
    expect(row.dataset.phase).toBe('exiting');
    expect(row.style.getPropertyValue('--chat-exit-duration')).toBe('240ms');
    chat.removeMessage('first');
    expect(root.childElementCount).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(root.childElementCount).toBe(0);
    chat.dispose();
  });

  it('ends exit on matching animation completion and falls back if CEF misses animationend', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const chat = createChatFeed(root, { ttlMs: 50, exit: 'fade', exitMs: 160 });
    chat.receive(message('first'));
    vi.advanceTimersByTime(50);
    const row = root.firstElementChild as HTMLElement;
    const unrelated = new Event('animationend', { bubbles: true });
    Object.defineProperty(unrelated, 'animationName', { value: 'message-in' });
    row.dispatchEvent(unrelated);
    expect(root.firstElementChild).toBe(row);
    const completed = new Event('animationend', { bubbles: true });
    Object.defineProperty(completed, 'animationName', { value: 'chat-out-fade' });
    row.dispatchEvent(completed);
    expect(root.childElementCount).toBe(0);
    chat.receive(message('second'));
    vi.advanceTimersByTime(50);
    expect(root.childElementCount).toBe(1);
    vi.advanceTimersByTime(300);
    expect(root.childElementCount).toBe(0);
    chat.dispose();
  });

  it('respects reduced motion and skips visual exit instead of holding stale rows', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const root = document.createElement('div');
    const chat = createChatFeed(root, { ttlMs: 50, exit: 'shrink' });
    chat.receive(message('first'));
    vi.advanceTimersByTime(50);
    expect(root.childElementCount).toBe(0);
    chat.dispose();
  });
});
