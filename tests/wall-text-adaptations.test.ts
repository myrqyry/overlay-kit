import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, optionsForEditor } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const arrivals = ['blur-focus', 'curtain-wipe', 'glitch-split', 'dissolve', 'split-flap', 'fold-collapse'] as const;
const css = readFileSync('src/wall-motion.css', 'utf8');
const packet: DisplayMessage = {
  id: 'image-motion', timestamp: 1700, user: { name: 'Tester', badges: [] },
  parts: [{ type: 'emote', emote: {
    id: 'layered', code: 'Layered', url: '/assets/smile.svg',
    overlays: [{ code: 'hat', url: '/assets/hat.svg' }], modifiers: [],
  } }],
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('image-adapted text specimen entrances', () => {
  it('offers every new entrance in the existing Wall selector and URL contract only', () => {
    const option = optionsForEditor('wall', false).find(item => item.key === 'wallEnter');
    expect(option).toBeDefined();
    for (const effect of arrivals) {
      expect(option?.choices?.some(choice => choice.value === effect)).toBe(true);
      const state = normalizeOptions({ ...DEFAULT_OPTIONS, wallEnter: effect });
      expect(state.wallEnter).toBe(effect);
      expect(readOptions('?' + writeOptions(state, 'wall'), 'wall').wallEnter).toBe(effect);
      expect(writeOptions(state, 'chat')).not.toContain('wallEnter');
    }
    expect(DEFAULT_OPTIONS.wallEnter).toBe('none');
    expect(normalizeOptions({ wallEnter: 'not-an-effect' }).wallEnter).toBe('none');
  });

  for (const effect of arrivals) {
    it(`${effect} uses the existing inner visual, preserving artwork and independent movement`, () => {
      const root = document.createElement('div');
      const wall = createEmoteWall(root, {
        wallEnter: effect, wallEnterMs: 560, motion: 'orbit',
        wallStyle: 'cut-paper', wallColor: 'warm', wallFinish: 'halo',
      });
      expect(wall.receive(packet)).toBe(1);
      const item = root.querySelector<HTMLElement>('[data-wall-item]')!;
      const visual = item.querySelector<HTMLElement>('.overlay-wall-visual')!;
      expect(item.dataset.motion).toBe('orbit');
      expect(visual.dataset.wallEnter).toBe(effect);
      expect(visual.style.getPropertyValue('--wall-enter-duration')).toBe('560ms');
      expect(visual.querySelectorAll('img')).toHaveLength(2);
      expect(visual.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
      expect(visual.querySelectorAll('.overlay-wall-fragment, .overlay-wall-echo')).toHaveLength(0);
      expect(root.dataset.wallStyle).toBe('cut-paper');
      expect(root.dataset.wallColor).toBe('warm');
      expect(root.dataset.wallFinish).toBe('halo');
      expect(css).toContain(`[data-wall-enter="${effect}"]:not([data-wall-phase="exiting"])`);
      expect(css).toContain(`@keyframes wall-in-${effect}`);
      // Entrance must release its wrapper filters and clip after completing.
      expect(css).toMatch(new RegExp(`animation: wall-in-${effect}[^;]*backwards;`));
      wall.removeMessage(packet.id);
      expect(root.childElementCount).toBe(0);
      wall.dispose();
    });
  }

  it('retains existing emotes when entrance settings hot-change, new ones use the new selection', () => {
    const root = document.createElement('div');
    const wall = createEmoteWall(root, { wallEnter: 'blur-focus', motion: 'float' });
    wall.receive(packet);
    const first = root.querySelector<HTMLElement>('.overlay-wall-visual')!;
    wall.configure({ wallEnter: 'glitch-split', wallStyle: 'ink-wash', wallColor: 'soft' });
    expect(root.querySelector<HTMLElement>('.overlay-wall-visual')).toBe(first);
    expect(first.dataset.wallEnter).toBe('blur-focus');
    wall.receive({ ...packet, id: 'second' });
    const second = root.querySelectorAll<HTMLElement>('.overlay-wall-visual')[1]!;
    expect(second.dataset.wallEnter).toBe('glitch-split');
    expect(root.dataset.wallStyle).toBe('ink-wash');
    expect(root.dataset.wallColor).toBe('soft');
    wall.dispose();
    expect(root.childElementCount).toBe(0);
  });

  it('reduced motion disables entrance animations and preserves expiry cleanup', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const root = document.createElement('div');
    const wall = createEmoteWall(root, {
      wallEnter: 'fold-collapse', wallExit: 'fade', ttlMs: 100,
    });
    wall.receive(packet);
    expect(root.querySelectorAll('.overlay-wall-visual')).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(root.querySelectorAll('.overlay-wall-visual')).toHaveLength(0);
    wall.dispose();
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.overlay-wall-visual\s*\{\s*animation:\s*none\s*!important;/);
  });
});
