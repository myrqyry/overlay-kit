# Emote Wall materials

The Emote Wall is the same scene regardless of its material pack. Its
Chatbus messages, sprite admission, aspect-ratio-safe sizing, placement,
moderation, capacity, expiry, Constellation field and motion paths remain
unchanged.

## Included treatments

- **Original** (`wallStyle=original`) — unchanged source artwork; the default
  for existing URLs, saved presets and consumers.
- **Cut Paper** (`wallStyle=cut-paper`) — layered, alpha-aware physical
  `drop-shadow` shadows following the actual combined emote/modifier artwork.
  No rectangular cards or enclosing circles.
- **Ink Wash** (`wallStyle=ink-wash`) — shared, bounded SVG pigment/alpha
  bleed filter. Uses `feGaussianBlur` on `SourceAlpha` under a desaturated
  original image. One filter definition is mounted per wall root and removed
  on style switch/disposal; it adds no animation loop, polling or fetch.
- **Holo Foil** (`wallStyle=holo-foil`) — subtle spectral grain overlaid
  with an SVG filter, clipped to the **combined** emote artwork via
  `SourceAlpha`. The original image and its modifiers remain one coherent
  visual, with no layer parallax, per-emote clones, timers or extra fetches.
  Each wall owns a disposable filter resource; it is opt-in and may require
  GPU filter work in large walls.

Change **Emote Wall → Wall material**, or use source URLs
`/wall.html?wallStyle=cut-paper` or `?wallStyle=ink-wash`. The styles can be
combined with Orbit, Flutter, Constellation, Assemble, Shatter, spawn region and
existing settings. Direct Chat OBS URLs omit this wall-only property.
Existing `/wall.html` URLs retain the Original appearance.

## Composable aesthetic choices

These are **separate** controls, not locked themes:

| Axis | Choices | URL option |
|---|---|---|
| Material | Original, Cut Paper, Ink Wash, Holo Foil | `wallStyle` |
| Color treatment | Original, Soft / faded, Vivid, Monochrome, Warm pigment | `wallColor` |
| Edge finish | None, Soft halo, Embossed relief | `wallFinish` |

Mix freely in **Emote Wall → Wall • Artwork**. For example,
`wall.html?wallStyle=cut-paper&wallColor=vivid&wallFinish=halo`
is different from
`wall.html?wallStyle=ink-wash&wallColor=soft&wallFinish=relief`.
Neither combination changes your chosen motion path or spawn region.
Existing source URLs remain unchanged and render as they did previously.

Options are defined in `src/wall-aesthetics.ts` and their settings/URL
contract in `src/options.ts`. Presentation is composed from independent CSS
filter variables in `src/wall-style-packs.css`; it applies to the joined
emote artwork at its intrinsic alpha rather than a square background card.
The mount helper `applyWallAesthetics` is independent of material-pack
mount/dispose and cleans up only its own data attributes.

This first collection deliberately covers material, color and edge treatments;
the existing Motion, Placement and Scene controls remain separate axes.
Color grading can alter recognizable source colors by choice, but Original
color preserves the original assets. No material/treatment/finish is imposed
on old presets. Strong combinations (e.g. Cut Paper + Halo) may require more
GPU filter passes for very large walls; keep the conservative default when
performance or visual fidelity is more important. Performance in real OBS
CEF remains unverified.

## Extension boundary

`src/wall-style-packs.ts` exposes `WallStylePack`, `listWallStylePacks`,
`registerWallStylePack`, `getWallStylePack`, and `applyWallStylePack`.
Both Chat and Wall use the common `src/style-pack-registry.ts` lifecycle
contract: a unique local id, label/description, optional `mount(root)` and a
cleanup function. A trusted host can register its own material, provide
scoped CSS and pass `wallStyle` to `createEmoteWall` or
`wall.configure({wallStyle: 'my-style'})`. Registration is local code
only, not arbitrary third-party JavaScript from a website.

The built-in CSS is exported via
`@myrqyry/overlay-kit/wall-style-packs.css`, automatically imported by
the editor/browser source. Style packs affect emote art only and do not
replace the artist's source files or artwork layers. They never take over
the animation or moderation lifecycle.

The shared registry validates IDs, rejects duplicates, falls back to the
default on unknown ids, and ensures cleanup only runs once. SVG filter ids
are unique per instance. Avoid adding per-sprite listeners, global
transforms that collide with animation, or continuous canvas loops.

## Verification boundaries

Unit tests cover independent source URL serialization, scene-preserving
switching, custom registration and idempotent disposal, multi-instance
filter isolation, moderation and original default. Chromium checks applied
filter CSS, that source images load and preserve their dimensions, and that
the editor produces the correct wall-specific URL. Native OBS CEF and
high-volume GPU-filter performance need separate real-host testing.
