import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, OPTION_DEFINITIONS } from '../src/options';
import { createChatMessageElement } from '../src/renderers';
import { createChatFeed } from '../src/views';

const css = readFileSync('src/chat-motion.css', 'utf8');
const effects = [
  'typewriter', 'split-flap', 'stagger-fade', 'blur-focus',
  'curtain-wipe', 'glitch-split', 'dissolve', 'fold-collapse', 'gravity-drop',
] as const;
const message = {
  id: 'specimen', timestamp: 1, user: { name: 'Alice', badges: [] },
  parts: [
    { type: 'text' as const, text: 'Hello 👩🏽‍💻 café! ' },
    { type: 'emote' as const, emote: {
      id: 'e', code: 'Smile', url: 'https://example.com/emote.png', overlays: [], modifiers: [],
    } },
  ],
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('text animation specimens in Overlay Kit chat', () => {
  for (const effect of effects) {
    it(`${effect}: persists in URLs, decorates only graphemes, and has motion CSS`, () => {
      const normalized = normalizeOptions({ ...DEFAULT_OPTIONS, letterEnter: effect });
      expect(normalized.letterEnter).toBe(effect);
      expect(readOptions('?' + writeOptions(normalized, 'chat'), 'chat').letterEnter).toBe(effect);
      const displayLabel = effect.replaceAll('-', ' ');
      expect(OPTION_DEFINITIONS.find(option => option.key === 'letterEnter')?.choices)
        .toContainEqual({ value: effect, label: displayLabel[0]!.toUpperCase() + displayLabel.slice(1) });
      const row = createChatMessageElement(message, { letterEnter: effect });
      const content = row.querySelector<HTMLElement>('.overlay-message-content')!;
      expect(row.dataset.letterEnter).toBe(effect);
      expect(content.textContent).toBe('Hello 👩🏽‍💻 café! ');
      expect(content.querySelectorAll('.overlay-letter').length).toBeGreaterThan(8);
      expect(content.querySelectorAll('.overlay-emote img')).toHaveLength(1);
      expect(content.querySelector('.overlay-emote .overlay-letter')).toBeNull();
      expect(css).toContain(`[data-letter-enter="${effect}"] .overlay-letter`);
      if(effect !== 'typewriter')expect(css).toContain(`@keyframes chat-letter-in-${effect}`);
    });
  }

  it('typewriter reveals one glyph at a time without removing real text', () => {
    const row = createChatMessageElement(message, { letterEnter: 'typewriter' });
    expect(row.querySelector('.overlay-message-content')?.textContent).toBe('Hello 👩🏽‍💻 café! ');
    expect(css).not.toContain('@keyframes chat-letter-in-typewriter');
    expect(css).toMatch(/\[data-letter-enter="typewriter"\] \.overlay-letter\s*\{[^}]*animation:\s*none/);
    expect(row.querySelectorAll('.overlay-typewriter-step').length).toBeGreaterThan(8);
    // The public renderer can also be used without ChatFeed: the timer owner
    // hides steps at mount, not while constructing an unattached row.
    expect(Array.from(row.querySelectorAll<HTMLElement>('.overlay-typewriter-step'))
      .every(step=>step.style.display==='')).toBe(true);
    const slow = createChatMessageElement(message, { letterEnter: 'typewriter', letterEnterMs: 600 });
    expect(slow.style.getPropertyValue('--letter-typing-step')).toBe('100ms');
  });

  it('split-flap uses bounded changing glyphs and restores them on moderation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T00:00:00Z'));
    const root = document.createElement('div');
    const feed = createChatFeed(root, { letterEnter: 'split-flap', ttlMs: 3000 });
    feed.receive(message);
    expect(root.querySelectorAll('[data-scrambling]').length).toBeGreaterThan(3);
    expect(root.querySelector('.overlay-message-content')?.textContent).toBe('Hello 👩🏽‍💻 café! ');
    feed.removeMessage('specimen');
    expect(root.querySelector('[data-scrambling]')).toBeNull();
    vi.advanceTimersByTime(3000);
    expect(feed.snapshot()).toHaveLength(0);
    feed.dispose();
  });

  it('long messages and reduced-motion mode never start split-flap timers', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const feed = createChatFeed(root, { letterEnter: 'split-flap' });
    feed.receive({ ...message, id: 'large', parts: [{ type: 'text', text: 'a'.repeat(350) }] });
    expect(root.querySelector('[data-scrambling]')).toBeNull();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    feed.receive({ ...message, id: 'reduced' });
    expect(root.querySelector('[data-scrambling]')).toBeNull();
    feed.dispose();
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.overlay-letter\s*\{\s*animation:\s*none\s*!important;/);
  });
});
