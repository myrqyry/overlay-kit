import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, normalizeOptions } from '../src/options';
import { restoreEditorSettings } from '../src/editor-settings';

const saved = {
  version: 1,
  settings: normalizeOptions({
    ...DEFAULT_OPTIONS,
    font: 34, size: 88, smoothReflow: true, exit: 'flip',
  }),
};

describe('editor settings recovery', () => {
  it('keeps saved edits when the editor URL has no options', () => {
    const restored = restoreEditorSettings(saved, '');
    expect(restored.settings).toEqual(saved.settings);
    expect(restored.importedFromUrl).toBe(false);
    expect(restored.remainingSearch).toBe('');
  });

  it('ignores unrelated query parameters rather than resetting saved edits', () => {
    const restored = restoreEditorSettings(saved, '?from=bookmark&view=chat');
    expect(restored.settings).toEqual(saved.settings);
    expect(restored.importedFromUrl).toBe(false);
    expect(restored.remainingSearch).toBe('from=bookmark&view=chat');
  });

  it('imports explicit settings URLs once, preserving unrelated parameters', () => {
    const restored = restoreEditorSettings(saved, '?from=bookmark&font=30&enter=pop&size=71');
    expect(restored.settings.font).toBe(30);
    expect(restored.settings.enter).toBe('pop');
    expect(restored.settings.size).toBe(71);
    // An explicit source/preset URL is based on defaults, not stale saved values.
    expect(restored.settings.exit).toBe(DEFAULT_OPTIONS.exit);
    expect(restored.importedFromUrl).toBe(true);
    expect(restored.remainingSearch).toBe('from=bookmark');
    // After consumed options are removed from history, refresh uses the saved import.
    expect(restoreEditorSettings({version:1,settings:restored.settings}, '?from=bookmark').settings)
      .toEqual(restored.settings);
  });

  it('recovers defaults when storage is empty or its version is unsupported', () => {
    expect(restoreEditorSettings(null, '').settings).toEqual(DEFAULT_OPTIONS);
    expect(restoreEditorSettings({ version: 999, settings: { font: 33 } }, '').settings)
      .toEqual(DEFAULT_OPTIONS);
    expect(restoreEditorSettings(saved, '?foo=bar&unknown=2').settings).toEqual(saved.settings);
  });

  it('provides a full default workspace value for an explicit reset without mutating presets', () => {
    const reset = normalizeOptions(DEFAULT_OPTIONS);
    expect(reset).toEqual(DEFAULT_OPTIONS);
    expect(reset).not.toBe(saved.settings);
    expect(saved.settings.font).toBe(34);
  });
});
