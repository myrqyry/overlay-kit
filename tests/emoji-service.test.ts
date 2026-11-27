import { describe, expect, it } from 'vitest';
import { emojiImageUrl, splitEmojiText } from '../src/emoji-service';
import { createChatMessageElement } from '../src/renderers';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const message: DisplayMessage = {
  id: 'emoji-msg', timestamp: 1000, user: { name: 'Viewer', badges: [] },
  parts: [
    { type: 'text', text: 'Hello 👩🏽‍💻 🇺🇸 1️⃣ ❤️, ' },
    { type: 'emote', emote: { id: 'k', code: 'Kappa', url: '/k.png', overlays: [], modifiers: [] } },
    { type: 'text', text: ' 🎉' },
  ],
};

describe('Unicode emoji services', () => {
  it('recognizes whole grapheme clusters, not partial emoji components or plain digits', () => {
    expect(splitEmojiText('A 👩🏽‍💻 🇺🇸 1️⃣ ❤️ B 1')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'emoji', text: '👩🏽‍💻' },
      { type: 'text', text: ' ' },
      { type: 'emoji', text: '🇺🇸' },
      { type: 'text', text: ' ' },
      { type: 'emoji', text: '1️⃣' },
      { type: 'text', text: ' ' },
      { type: 'emoji', text: '❤️' },
      { type: 'text', text: ' B 1' },
    ]);
    expect(splitEmojiText('<img onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img onerror=alert(1)>' }]);
  });

  it('uses pinned, allowlisted assets without a third-party script', () => {
    expect(emojiImageUrl('❤️', 'twemoji')).toBe('https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/2764.svg');
    expect(emojiImageUrl('👩🏽‍💻', 'openmoji')).toBe('https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/1F469-1F3FD-200D-1F4BB.svg');
    expect(emojiImageUrl('😀', 'system')).toBeUndefined();
    expect(emojiImageUrl('👩🏽‍💻', 'noto')).toBe('https://raw.githubusercontent.com/googlefonts/noto-emoji/99701e07d3d1fe1bdbcdb14964547f0fd592966f/2D/svg/emoji_u1f469_1f3fd_200d_1f4bb.svg');
    expect(emojiImageUrl('❤️', 'noto')).toBe('https://raw.githubusercontent.com/googlefonts/noto-emoji/99701e07d3d1fe1bdbcdb14964547f0fd592966f/2D/svg/emoji_u2764.svg');
    expect(emojiImageUrl('1️⃣', 'noto')).toBe('https://raw.githubusercontent.com/googlefonts/noto-emoji/99701e07d3d1fe1bdbcdb14964547f0fd592966f/2D/svg/emoji_u0031_20e3.svg');
    expect(emojiImageUrl('🇺🇸', 'noto')).toBeUndefined(); // Noto's source SVG set omits national flag pairs.
  });

  it('preserves browser-native defaults but renders selected provider images inline with safe fallback', () => {
    const native = createChatMessageElement(message);
    expect(native.querySelectorAll('img[data-unicode-emoji]')).toHaveLength(0);
    expect(native.querySelector('.overlay-message-content')?.textContent).toContain('👩🏽‍💻');
    const custom = createChatMessageElement(message, { emojiService: 'twemoji' });
    const emoji = custom.querySelector<HTMLImageElement>('img[data-unicode-emoji]')!;
    expect(custom.querySelectorAll('img[data-unicode-emoji]')).toHaveLength(5);
    expect(emoji.alt).toBe('👩🏽‍💻');
    expect(emoji.style.width).toBe('1em'); // Stable chat layout before SVG load.
    expect(custom.querySelectorAll('.overlay-emote')).toHaveLength(1);
    emoji.dispatchEvent(new Event('error'));
    expect(custom.querySelectorAll('img[data-unicode-emoji]')).toHaveLength(4);
    expect(custom.querySelector('.overlay-message-content')?.textContent).toContain('👩🏽‍💻');
  });

  it('adds only Unicode emoji as optional wall artwork without changing Chatbus emotes', () => {
    const root = document.createElement('div');
    const wall = createEmoteWall(root, { emojiService: 'twemoji', maxActive: 20, motion: 'still' });
    expect(wall.receive(message)).toBe(6);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(6);
    expect(root.querySelectorAll('img[src$="/k.png"]')).toHaveLength(1);
    const image = root.querySelector<HTMLImageElement>('img[src*="twemoji"]')!;
    expect(image.alt).toBe('👩🏽‍💻');
    wall.removeMessage(message.id);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(0);
    wall.dispose();

    const unchanged = createEmoteWall(root, { maxActive: 20 });
    expect(unchanged.receive(message)).toBe(1);
    unchanged.dispose();
  });

  it('uses Noto color artwork in Chat and Wall and preserves fallback text for unsupported flags', () => {
    const chat = createChatMessageElement(message, {emojiService:'noto'});
    expect(chat.querySelectorAll('img[data-unicode-emoji="noto"]')).toHaveLength(4);
    expect(chat.querySelector('.overlay-message-content')?.textContent).toContain('🇺🇸');
    const root = document.createElement('div');
    const wall = createEmoteWall(root, {emojiService:'noto',maxActive:20,motion:'still'});
    expect(wall.receive(message)).toBe(6);
    expect(root.querySelectorAll('img[data-unicode-emoji="noto"]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(6);
    wall.dispose();
  });

  it('roundtrips independently scoped Chat and Wall service options', () => {
    const chosen = normalizeOptions({ chatEmojiService: 'openmoji', wallEmojiService: 'twemoji' });
    expect(writeOptions(chosen, 'chat')).toBe('emoji=openmoji');
    expect(writeOptions(chosen, 'wall')).toBe('wallEmoji=twemoji');
    expect(readOptions('?emoji=openmoji', 'chat').chatEmojiService).toBe('openmoji');
    expect(readOptions('?wallEmoji=twemoji', 'wall').wallEmojiService).toBe('twemoji');
    expect(normalizeOptions({ chatEmojiService: 'https://evil.invalid', wallEmojiService: 'bogus' }).chatEmojiService)
      .toBe(DEFAULT_OPTIONS.chatEmojiService);
    expect(normalizeOptions({ wallEmojiService: 'bogus' }).wallEmojiService)
      .toBe(DEFAULT_OPTIONS.wallEmojiService);
    const google = normalizeOptions({ chatEmojiService: 'noto', wallEmojiService: 'noto' });
    expect(writeOptions(google, 'chat')).toBe('emoji=noto');
    expect(writeOptions(google, 'wall')).toBe('wallEmoji=noto');
    expect(readOptions('?emoji=noto','chat').chatEmojiService).toBe('noto');
    expect(readOptions('?wallEmoji=noto','wall').wallEmojiService).toBe('noto');
  });
});
