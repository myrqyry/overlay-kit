# Events type and tier overrides

The Events tab has one base visual configuration and an optional ordered list of
overrides. A subscription alert, for example, uses the base settings until a
rule for `subscription` tier `2` or `3` matches. An override replaces only the
fields it declares; everything else inherits the base.

## Where

**Events → Presentation → Type and tier overrides** is a compact repeater:

- **Event** — subscription, gift subscription, raid, follow, cheer, donation,
  or reward redemption.
- **Tier (optional)** — a provider tier label. Leave empty to target the whole
  event type.
- **Appearance / Accent / Typeface / Entrance / Entrance duration / Exit /
  Exit duration / Text size** — each field has an **Inherit base** state.

Add one rule per desired target. Rules are stored in `eventOverrides` as JSON in
Events presets, current editor settings and OBS source URLs. The parser is
bounded to 12 rules and silently drops malformed entries so one bad link cannot
break the whole Events configuration.

## Matching

1. A rule must match the alert's event kind.
2. A rule with a matching tier beats a type-only rule.
3. If two rules have the same specificity, the later rule wins.
4. Unmatched alerts use the base settings.

The active alert applies its resolved values to the existing alert surface; this
does not create a second renderer or transport. Overrides affect presentation
only: event admission, trigger toggles, queue order, text, and Chatbus data are
unchanged.

## Tier evidence

Chatbus supplies `SocialSignalV1.event.tier` only when the source reports a
known tier:

- Twitch `1000` / `2000` / `3000` become `1` / `2` / `3`; `Prime` stays `Prime`.
- YouTube keeps its supplied member-level name.
- Providers or events without known tier evidence have no tier, so only a
  type-wide rule can match them.

Tier labels are provider-scoped. They are not cross-platform identity rankings,
and Overlay Kit never infers them from usernames, badge artwork or prices.
Matching is case-insensitive and normalizes the Twitch numeric labels.

## Verification boundary

Unit tests cover bounded parsing, option/preset/URL round-tripping, precedence,
tier normalization, and application to the real alert surface. The full suite
passed 570 tests across 102 files, with TypeScript and the production build.
Built-Chromium checks verified the editor repeater and a synthetic tier-3
subscription using the violet/paper/fold-collapse/dissolve override on the real
Events page, with zero page errors. This is not a native OBS CEF or
live-provider tier test.
