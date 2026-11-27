# 7TV name paints in OverlayKit

The Chatbus identity resolver produces typed `NamePaint` metadata, and
OverlayKit projects **only** allowlisted values into presentation-owned DOM. The same sanitized paint contract can render the username and, when **Message background source → Name paint** is selected, bounded message-background layers. It does not accept remote CSS strings or executable data.

Supported from live 7TV v3 cosmetics:

- Signed/unsigned ARGB decoded to CSS RGBA; legacy single-layer
  `function`/`stops` fields when `gradients` is empty
- Linear/radial and repeating gradients, multiple gradient backgrounds,
  position/size/repeat metadata when supplied
- HTTPS paint images (unsafe URL schemes are excluded)
- Alpha-following drop shadows, text weight/transform/variant, text stroke
  and independent text shadows
- Gradient stops outside 0–100% when valid, with bounds on extreme
  malformed values; paint removal restores the original Twitch username color

OverlayKit's own **Chat → Typography → Text shadow** must *not* tint 7TV
text-clipped painted usernames. The chat row still carries this selected shadow
for normal message text and unpainted usernames, but painted usernames and
their text-clipped layer nodes explicitly reset the inherited OverlayKit shadow.
Provider-supplied 7TV shadows and drop shadows are applied separately from
the paint metadata, and resetting an identity paint restores ordinary shadow
inheritance. Avoid attempting to fix this brightness issue by modifying the
provider paint colors, disabling the entire row's text shadow, or replacing
the 7TV provider's own shadow effects.

**Name paint background blur** (Chat → Styling) optionally softens just the
message fill when Message background source is Name paint. A bounded 0–48px native CSS Gaussian blur lives on one overscanned
inner layer group clipped to the bubble radius;
separate bubble outline and live text, badges and emotes stay sharp. At
0px the former flat layer DOM remains unchanged. Blur is not a backdrop filter;
it cannot blur the video or chat scene behind a transparent bubble.
Solid-only paint stacks, fully transparent fills and stacks with no visible
non-solid detail bypass the filter entirely. No per-layer blur passes,
forced compositor layers, custom shaders or animation loops are introduced.
Large radii still increase filtering work and the overscanned area; browser
and GPU-specific performance is not guaranteed.

Verification (2026-11-17): 544 tests, TypeScript and production build passed.
The production editor Chromium smoke changed the blur from 0 to 48 and
back for three synthetic paint fixtures. Detailed paint used one native
blur surface, changing 20,986 pixels; solid-only and invisible-detail
fixtures used zero filter surfaces and were pixel-identical with the setting
on/off. Text and outline filters were unchanged, the OBS URL contained
messagePaintBlur=48, and disabling restored the detailed fixture exactly.
No page errors. Reproduce with pnpm build then pnpm exec tsx
tests/manual/name-paint-blur-smoke.mts (Playwright, Chromium, Python Pillow;
PLAYWRIGHT_ENTRY and BROWSER_BIN override paths). Native OBS CEF and
comparative GPU timings remain untested.
The selected blur and **Max message width** values are stored in OBS URLs
and presets and update existing chat rows without restarting transport.

Name text effects (weight, transform, text stroke and text shadows) remain username-only. Paint color/gradient/image layers may also be reused as a message background. When **Chat → Styling → Message outline** is above zero, the same validated paint colors and ordered layers color the rounded bubble outline **regardless of whether the fill uses Theme, User color, or Name paint**. Gradients remain gradients rather than being reduced to their first stop. A transparent background does not erase the outline, and outline thickness remains controlled by the existing slider (no new setting). Solid-color outline layers use owned, clipped native CSS rounded borders for clean inner curves; floating nameplates round both cut ends with responsive CSS shape() clipping and local layout measurements so entrance scaling, resized messages and emotes cannot remove left/right/bottom outlines; the gap excludes the header's transparent inline padding and adds only outline-sized clearance, preserving the top-left arc with crowded badge rows; older Chromium/CEF versions without shape() retain the complete outline via a responsive polygon fallback (square caps); actual gradient and image layers retain bounded CSS masks, preserving their ordered artwork. Transparent or missing paint falls back to the existing solid-color border. The layer DOM is removed/rebuilt when a late identity paint or appearance setting changes. The outline never replaces badges, message content, Chatbus parsing, chat layout, or the scene expiry clock. The existing Message background opacity multiplies **fill** paint-layer opacity, not outline opacity. If a user has no usable paint, Name paint background falls back to the normalized user color and then to the theme background. Rendering in a browser does not establish OBS CEF GPU
performance; complex multi-layer/image paints may cost more.

`vendor/chatbus` is a tracked snapshot, not a live sibling-worktree link.
Update it from a verified Chatbus commit using `git archive`, record the
exact `UPSTREAM_COMMIT`, then run tests and `pnpm build` so the tracked
`api/live.js` server bundle remains in sync with the parser.

Chatbus v4 paint lookup is also consumed when a Twitch user ID is available.
OverlayKit prefers that current v4 paint and falls back to the v3 identity
paint when v4 has no usable paint. Ordered solid, linear, radial and HTTPS
image layers are projected with bounded per-layer opacity; unsafe image
schemes are discarded. For usernames, every v4 layer is rendered as an independent text-clipped DOM layer. For message backgrounds, the same bounded layers are rendered behind the identity/body content with independent opacity and inherited bubble radius. HTTPS image validation and gradient bounds are shared; provider-authored CSS is never executed.

This is still a snapshot lookup, not a live 7TV entitlement subscription:
paint changes that occur after a message resolves are not pushed into an
already-rendered row unless a later identity update is emitted.
