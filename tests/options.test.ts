import { describe, expect, it } from 'vitest';
import { OPTION_DEFINITIONS, DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, PRESETS } from '../src/options';

describe('Overlay Kit option definitions and versioned preset contract', () => {
  it('has a unique declarative control for every option and safe defaults', () => {
    expect(new Set(OPTION_DEFINITIONS.map(item => item.key)).size).toBe(OPTION_DEFINITIONS.length);
    expect(OPTION_DEFINITIONS.length).toBeGreaterThanOrEqual(16);
    for (const item of OPTION_DEFINITIONS) {
      expect(item.label.length).toBeGreaterThan(2);
      expect(item.section).toMatch(/^(Shared|Chat|Wall|Avatars|Events) /);
      expect(Object.hasOwn(DEFAULT_OPTIONS, item.key)).toBe(true);
      expect(normalizeOptions({ [item.key]: DEFAULT_OPTIONS[item.key] })[item.key])
        .toBe(DEFAULT_OPTIONS[item.key]);
    }
  });

  it('sanitizes range boundaries, enum inputs and invalid values without accepting unknown options', () => {
    const result = normalizeOptions({
      font: 900, ttl: -5, size: Number.NaN, motion: 'javascript:evil',
      showBadges: 'false', align: 'right', fontFamily: 'mono', unknown: '<img onerror=alert(1)>',
    });
    expect(result.font).toBe(64);
    expect(result.ttl).toBe(1);
    expect(result.size).toBe(DEFAULT_OPTIONS.size);
    expect(result.motion).toBe(DEFAULT_OPTIONS.motion);
    expect(result.showBadges).toBe(false);
    expect(result.align).toBe('right');
    expect(result.fontFamily).toBe('mono');
    expect(Object.hasOwn(result, 'unknown')).toBe(false);
  });

  it('roundtrips URL values and honors explicit true and false with minimal query size', () => {
    const custom = normalizeOptions({
      ...DEFAULT_OPTIONS, font: 30, align: 'center', motion: 'bounce',
      showBadges: false, showNames: true, showTimestamp: true, stroke: 2,
      shadow: 'strong', wallSpeed: 1.7,
    });
    const query = writeOptions(custom);
    expect(query).toContain('font=30');
    expect(query).toContain('badges=0');
    expect(query).not.toContain('names=1');
    expect(readOptions('?' + query)).toEqual(custom);
  });

  it('roundtrips bounded explicit ignored-user lists for chat, wall and avatars', () => {
    const custom = normalizeOptions({
      chatIgnoredUsers:' @NightBot, CloudCat, nightbot ',
      wallIgnoredUsers:'StreamElements',
      avatarIgnoredUsers:'Moobot',
    });
    expect(custom.chatIgnoredUsers).toBe('nightbot,cloudcat');
    expect(custom.wallIgnoredUsers).toBe('streamelements');
    expect(custom.avatarIgnoredUsers).toBe('moobot');
    expect(readOptions('?chatIgnore=NightBot%2CCloudCat','chat').chatIgnoredUsers)
      .toBe('nightbot,cloudcat');
    expect(writeOptions(custom,'chat')).toContain('chatIgnore=nightbot%2Ccloudcat');
    expect(writeOptions(custom,'wall')).toContain('wallIgnore=streamelements');
    expect(writeOptions(custom,'avatars')).toContain('avatarIgnore=moobot');
  });

  it('validates versioned imported presets and rejects future schema versions', () => {
    expect(normalizeOptions({ version: 1, settings: { font: 25, showNames: false } }).font).toBe(25);
    expect(() => normalizeOptions({ version: 2, settings: { font: 99 } })).toThrow(/version/);
    expect(Object.keys(PRESETS)).toContain('classic');
    for (const preset of Object.values(PRESETS)) {
      expect(normalizeOptions(preset)).toEqual(preset);
    }
  });
});
