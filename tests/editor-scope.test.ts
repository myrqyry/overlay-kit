import { describe, expect, it } from 'vitest';
import { OPTION_DEFINITIONS, optionsForEditor, type OverlayEditorView } from '../src/options';

describe('overlay-specific editor scopes', () => {
  it('partitions chat and emote wall controls without losing common settings', () => {
    const chatCapacity = ['max', 'ttl', 'size'];
    const wallCapacity = ['wallMax', 'wallTtl', 'wallSize'];
    const chat = optionsForEditor('chat', true);
    const wall = optionsForEditor('wall', true);
    expect(chat.map(def => def.key)).toEqual(expect.arrayContaining(chatCapacity));
    expect(wall.map(def => def.key)).toEqual(expect.arrayContaining(wallCapacity));
    expect(chat.some(def => def.key === 'fontFamily')).toBe(true);
    expect(chat.some(def => def.key === 'chatIgnoredUsers')).toBe(true);
    expect(chat.some(def => def.key === 'motion')).toBe(false);
    expect(wall.some(def => def.key === 'spawn')).toBe(true);
    expect(wall.some(def => def.key === 'wallIgnoredUsers')).toBe(true);
    expect(wall.some(def => def.key === 'shadow')).toBe(false);
    const avatars = optionsForEditor('avatars', true);
    expect(avatars.map(def => def.key)).toEqual(expect.arrayContaining(['avatarsMax','avatarSize','avatarActivity','avatarNames','avatarIgnoredUsers']));
    expect(avatars.every(def => def.section.startsWith('Avatars •'))).toBe(true);
    const events = optionsForEditor('events', true);
    expect(events.every(def => def.section.startsWith('Events •'))).toBe(true);
    expect(events.map(def => def.key)).toContain('eventDuration');
    const combined = new Set([...chat, ...wall, ...avatars, ...events].map(item => item.key));
    expect(combined).toEqual(new Set(OPTION_DEFINITIONS.map(item => item.key)));
    expect(chat.filter(def => wall.includes(def)).map(def => def.key)).toEqual([]);
  });

  it('shows every setting for the selected overlay without a hidden advanced mode', async () => {
    for (const view of ['chat', 'wall', 'avatars', 'events'] satisfies OverlayEditorView[]) {
      const visible = optionsForEditor(view, false);
      const formerlyAdvanced = optionsForEditor(view, true);
      expect(visible).toEqual(formerlyAdvanced);
    }
    const {readFileSync}=await import('node:fs');
    const {resolve}=await import('node:path');
    const html=readFileSync(resolve(import.meta.dirname,'../index.html'),'utf8');
    expect(html).not.toContain('advanced-options');
    expect(html).not.toMatch(/Show advanced settings/i);
  });

  it('searches only the current view across all settings and hints', () => {
    expect(optionsForEditor('wall', false, 'physics')).toEqual([]);
    expect(optionsForEditor('chat', false, 'outline').map(item => item.key)).toEqual(['stroke','messagePaintBlur','messageOutline']);
    expect(optionsForEditor('wall', false, 'distance').map(item => item.key)).toEqual(['wallDistance']);
    expect(optionsForEditor('chat', true, 'spawn region')).toEqual([]);
  });
});
