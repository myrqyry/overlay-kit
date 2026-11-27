export type AlertKind = 'subscription'|'gift-subscription'|'raid'|'follow'|'cheer'|'donation'|'reward-redemption';
export const ALERT_KINDS: readonly AlertKind[] = [
  'subscription','gift-subscription','raid','follow','cheer','donation','reward-redemption',
];

export type EventStyle = 'soft'|'paper'|'minimal';
export type EventAccent = 'theme'|'mint'|'amber'|'rose'|'violet'|'monochrome';
export type EventFamily = 'system'|'rounded'|'mono'|'serif';
export type EventEntrance =
  'rise'|'pop'|'sweep'|'unfold'|'flip'|'spring'|
  'blur-focus'|'curtain-wipe'|'glitch-split'|'dissolve'|'split-flap'|'fold-collapse'|'none';
export type EventExit =
  'none'|'fade'|'sink'|'shrink'|'flip'|'spring'|
  'blur-out'|'curtain-close'|'glitch-split'|'dissolve'|'split-flap'|'fold-collapse';

export const EVENT_STYLES: readonly EventStyle[] = ['soft','paper','minimal'];
export const EVENT_ACCENTS: readonly EventAccent[] = ['theme','mint','amber','rose','violet','monochrome'];
export const EVENT_FAMILIES: readonly EventFamily[] = ['system','rounded','mono','serif'];
export const EVENT_ENTRANCES: readonly EventEntrance[] = [
  'rise','pop','sweep','unfold','flip','spring',
  'blur-focus','curtain-wipe','glitch-split','dissolve','split-flap','fold-collapse','none',
];
export const EVENT_EXITS: readonly EventExit[] = [
  'none','fade','sink','shrink','flip','spring',
  'blur-out','curtain-close','glitch-split','dissolve','split-flap','fold-collapse',
];

/** Settings that a type or tier override may replace. Base values come from
 * the Events options; unmatched fields inherit them. */
export interface EventVisualSettings {
  style: EventStyle;
  accent: EventAccent;
  fontFamily: EventFamily;
  motion: EventEntrance;
  motionMs: number;
  exit: EventExit;
  exitMs: number;
  fontSize: number;
}
export interface EventOverride {
  kind: AlertKind;
  /** Optional normalized tier, for example 1/2/3, prime, or a member level name. */
  tier?: string;
  settings: Partial<EventVisualSettings>;
}
export const EVENT_VISUAL_DEFAULT: EventVisualSettings = {
  style: 'soft', accent: 'theme', fontFamily: 'system', motion: 'rise',
  motionMs: 340, exit: 'fade', exitMs: 300, fontSize: 36,
};
const SETTING_KEYS = new Set<keyof EventVisualSettings>(Object.keys(EVENT_VISUAL_DEFAULT) as (keyof EventVisualSettings)[]);
const MAX_OVERRIDES = 12;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value: unknown, min: number, max: number): number|undefined => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined;
};
/** Tier keys are compared case-insensitively. Twitch's 1000/2000/3000 tiers
 * become 1/2/3; other provider level names stay readable. */
export function normalizeEventTier(value: unknown): string {
  const raw = text(value, 32).toLocaleLowerCase();
  if (/^\d+$/.test(raw)) {
    const map: Record<string,string> = {'1000':'1','2000':'2','3000':'3'};
    return map[raw] ?? raw;
  }
  return raw.replace(/\s+/g,' ');
}

/** Bounded, presentation-only parser. Invalid entries are dropped rather than
 * breaking an otherwise valid Events URL or preset. */
export function parseEventOverrides(input: unknown): EventOverride[] {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [];
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const result: EventOverride[] = [];
  for (const item of parsed.slice(0, MAX_OVERRIDES)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const value = item as Record<string, unknown>;
    const kind = text(value.kind, 32) as AlertKind;
    if (!ALERT_KINDS.includes(kind)) continue;
    const tier = normalizeEventTier(value.tier);
    const settings: Partial<EventVisualSettings> = {};
    const source = value.settings;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const record = source as Record<string, unknown>;
      for (const key of SETTING_KEYS) {
        if (!(key in record)) continue;
        const raw = record[key];
        if (key === 'style' && EVENT_STYLES.includes(raw as EventStyle)) settings.style = raw as EventStyle;
        else if (key === 'accent' && EVENT_ACCENTS.includes(raw as EventAccent)) settings.accent = raw as EventAccent;
        else if (key === 'fontFamily' && EVENT_FAMILIES.includes(raw as EventFamily)) settings.fontFamily = raw as EventFamily;
        else if (key === 'motion' && EVENT_ENTRANCES.includes(raw as EventEntrance)) settings.motion = raw as EventEntrance;
        else if (key === 'exit' && EVENT_EXITS.includes(raw as EventExit)) settings.exit = raw as EventExit;
        else if (key === 'motionMs') { const value = number(raw, 100, 1500); if (value !== undefined) settings.motionMs = value; }
        else if (key === 'exitMs') { const value = number(raw, 100, 1500); if (value !== undefined) settings.exitMs = value; }
        else if (key === 'fontSize') { const value = number(raw, 16, 80); if (value !== undefined) settings.fontSize = value; }
      }
    }
    result.push({ kind, ...(tier ? { tier } : {}), settings });
  }
  return result;
}
export function serializeEventOverrides(overrides: readonly EventOverride[]): string {
  const parsed = parseEventOverrides(overrides);
  return parsed.length ? JSON.stringify(parsed) : '';
}

/** The exact type+tier rule wins over a type-only rule; later rules win ties. */
export function resolveEventVisual(
  base: EventVisualSettings,
  overrides: readonly EventOverride[],
  kind: AlertKind,
  tier?: string,
): EventVisualSettings {
  let best: EventOverride|undefined;
  let bestScore = 0;
  const wanted = normalizeEventTier(tier);
  for (const override of overrides) {
    if (override.kind !== kind) continue;
    const hasTier = Boolean(override.tier);
    if (hasTier && override.tier !== wanted) continue;
    const score = hasTier ? 2 : 1;
    if (score >= bestScore) { best = override; bestScore = score; }
  }
  return best ? { ...base, ...best.settings } : base;
}
