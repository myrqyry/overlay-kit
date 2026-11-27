# Chat exit edge fade

Chat → Styling now exposes the existing spatial edge mask as six styles:
Linear (previous gradient), Soft feather (smoothstep), Quick recovery
(ease-out), Slow recovery (ease-in), Terraced (2–12 discrete opacity
increments), and Hard cut (single sharp transition). These are spatial
transparency profiles, not timed exit animations. Auto direction is top
for bottom-anchored Stack, bottom for top-anchored Stack and left for
Horizontal Strip. Latest Only has no departing edge and does not use
this mask.

Controls: percent distance (0–40% of canvas), or pixels (0–1200px,
clamped proportionally to the canvas dimension); minimum edge opacity
(0–100%); hold (0–90% of the fade region at the starting opacity);
terrace step count (2–12, default 4). Hard cut has no hold control.
Zero active distance or 100% opacity clears the mask. Percent remains
the default, with zero distance; pixel distance defaults to 120 when
selected. Switching units preserves the other distance and hidden
controls retain their values. Legacy links using edgeFade alone preserve
the exact original gradient.

One validated settings manifest persists the new keys in editor state,
chat presets and OBS links. Existing view applies bounded CSS gradient
stops to its own root; no animation loop, extra DOM, dependencies,
transport changes or row lifetime changes. Native OBS CEF not tested.

## Verification

Focused regression tests passed (legacy compatibility, URL roundtrip,
bounded options, profile/direction switching and unchanged row lifetime).
Full suite 539/539, 97 files; TypeScript and production build passed.
The production browser smoke uses a white test-only background on the
actual chat root to isolate rendered mask alpha. Chromium screenshot
alpha sampled at 0/40/80/120/161px in a 160px fade region:

| Style | Alpha (0–255) |
| --- | --- |
| Linear | 1, 65, 128, 192, 255 |
| Soft feather | 0, 41, 129, 216, 255 |
| Quick recovery | 2, 113, 192, 239, 255 |
| Slow recovery | 0, 16, 65, 144, 255 |
| Terraced | 0, 64, 128, 191, 255 |
| Hard cut | 0, 0, 0, 0, 255 |

Also checked 25% starting opacity / 50% hold, opposite stack anchoring,
horizontal strip, 1200px region clamped to 400px, and disabled cases.
The actual editor exposed the right contextual controls, updated the
preview in place, generated matching OBS URLs, and restored the
previous 24% setting after switching back from pixels. No page errors.
This is a browser transparency measurement, not GPU benchmarking.

Reproduce: pnpm build then pnpm exec tsx
tests/manual/exit-edge-fade-smoke.mts with Playwright, Chromium and
Python Pillow available. PLAYWRIGHT_ENTRY and BROWSER_BIN override
local browser paths.


## Scene-integrating edge textures

The new Exit edge texture choice is independent of the fade profile.
Pixel dither removes ordered pixel cells as chat approaches the edge.
Scattered grain removes deterministic irregular cells; Torn paper uses
a jagged repeating contour. Each has zero coverage at the exit boundary
and full coverage by the interior of the configured region. The texture
scale (2–24px, default 6) controls spacing across the edge; depth uses
16 bands spread across the selected fade distance. These are true
transparent cutouts showing the underlying OBS scene, not painted
backgrounds, actual moving debris, geometry deformation or blur.

Texture defaults to None. Use any positive fade distance, and combine
with a fade profile or set edge opacity to 100% for texture only.
The bounded generated SVG tile repeats across the departing edge;
standard layered CSS masks intersect the opacity gradient with the
texture and opaque interior. No remote artwork, extra DOM, timing loop,
provider changes, or additional dependency. Switching texture off clears
the mask layers and restores the exact previous gradient. With no support
for standard mask compositing, the existing fade is used (texture-only
falls back to a linear fade). Native OBS CEF remains untested.

The three new unit tests first failed, then passed. In real production
Chromium at 400x400, 160px pixel region and 8px cross-edge spacing, the
texture-only midpoint had 96/224/196 fully transparent pixels and
304/176/174 fully opaque pixels for dither/grain/fringe, respectively;
the jagged contour also has antialiased boundary pixels. All 400 outer
edge pixels had zero alpha; the inner region had 400 fully opaque
pixels. Combining each texture with the linear fade retained the holes
and yielded maximum midpoint alpha 128 of 255. Verified all three exit
directions, disabled Latest Only, editor hot switching, generated source
URLs, and cleanup without page errors. The existing opacity profiles
remain unchanged. Full suite 542 tests (97 files), typecheck and
production build pass.

Reproduce with pnpm build and pnpm exec tsx
tests/manual/exit-edge-texture-smoke.mts (Playwright, Chromium, Python
Pillow; same browser path overrides as the earlier smoke).
