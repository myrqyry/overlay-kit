/**
 * Unicode emoji artwork is independent of Chatbus provider emotes.
 * No remote scripts, URL input or HTML parsing: only pinned static SVG assets.
 */
export type EmojiService = 'system' | 'twemoji' | 'openmoji' | 'noto';
export type WallEmojiService = 'off' | EmojiService;

export interface EmojiSegment {
  type: 'text' | 'emoji';
  text: string;
}

const PICTOGRAPH = /\p{Extended_Pictographic}/u;
const REGIONAL_FLAG = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /^[0-9#*]\uFE0F?\u20E3$/u;

/** Segment full graphemes so ZWJ families, flags, modifiers and keycaps stay intact. */
export function splitEmojiText(value: string): EmojiSegment[] {
  const segments: EmojiSegment[] = [];
  // Older embedded browser runtimes can lack Segmenter: retain native text.
  if (typeof Intl.Segmenter !== 'function') return value ? [{ type: 'text', text: value }] : [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let plain = '';
  for (const { segment } of segmenter.segment(value)) {
    const isEmoji = PICTOGRAPH.test(segment) || REGIONAL_FLAG.test(segment) || KEYCAP.test(segment);
    if (isEmoji) {
      if (plain) segments.push({ type: 'text', text: plain });
      plain = '';
      segments.push({ type: 'emoji', text: segment });
    } else plain += segment;
  }
  if (plain) segments.push({ type: 'text', text: plain });
  return segments;
}

/** Provider paths are derived exclusively from Unicode scalar values. */
export function emojiImageUrl(emoji: string, service: EmojiService): string | undefined {
  if (service === 'system') return undefined;
  const scalars = Array.from(emoji, character => character.codePointAt(0)!);
  if (!scalars.length || scalars.length > 16) return undefined;
  if (service === 'twemoji') {
    // Twemoji excludes the emoji presentation selector in SVG file names.
    const name = scalars.filter(point => point !== 0xfe0f && point !== 0xfe0e)
      .map(point => point.toString(16)).join('-');
    return 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/' + name + '.svg';
  }
  if (service === 'openmoji') {
    const name = scalars.map(point => point.toString(16).toUpperCase()).join('-');
    return 'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/' + name + '.svg';
  }
  if (service === 'noto') {
    // Noto's source SVGs exclude national flag pairs; leave their native glyph intact.
    if (REGIONAL_FLAG.test(emoji)) return undefined;
    const name = scalars.filter(point => point !== 0xfe0f && point !== 0xfe0e)
      .map(point => point.toString(16).padStart(4, '0')).join('_');
    return 'https://raw.githubusercontent.com/googlefonts/noto-emoji/99701e07d3d1fe1bdbcdb14964547f0fd592966f/2D/svg/emoji_u' + name + '.svg';
  }
  return undefined;
}

/** A DOM-only, text-preserving image. Failure always restores the original glyph. */
export function createEmojiNode(emoji: string, service: EmojiService): Node {
  const source = emojiImageUrl(emoji, service);
  if (!source) return document.createTextNode(emoji);
  const image = document.createElement('img');
  image.src = source;
  image.alt = emoji;
  image.dataset.unicodeEmoji = service;
  image.draggable = false;
  image.decoding = 'async';
  image.style.display = 'inline-block';
  image.style.height = '1em';
  image.style.width = '1em';
  image.style.objectFit = 'contain';
  image.style.maxWidth = 'none';
  image.style.verticalAlign = '-0.12em';
  image.addEventListener('error', () => image.replaceWith(document.createTextNode(emoji)), { once: true });
  return image;
}

export function appendEmojiText(container: Node, text: string, service: EmojiService): void {
  if (service === 'system') {
    container.appendChild(document.createTextNode(text));
    return;
  }
  // Bound image creation for malicious/accidental emoji floods; preserve the rest as text.
  let count = 0;
  for (const segment of splitEmojiText(text)) {
    if (segment.type === 'emoji' && count < 120) {
      container.appendChild(createEmojiNode(segment.text, service));
      count++;
    } else container.appendChild(document.createTextNode(segment.text));
  }
}
