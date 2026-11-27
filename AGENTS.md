# Overlay Kit project rules

- Core transport-neutral. Chatbus owns platform/provider normalization; views must not duplicate chat connection code.
- Renderer and clock injection stay supported. No fake live-chat connectors: test fixtures are explicitly labeled preview.
- No leaked DOM objects, timers, RAF loops, animation timelines, listeners or physics bodies. Use per-entity dispose.
- Untrusted chat text never enters innerHTML. Only explicitly safe image schemes in basic renderers.
- Verify behavior with tests and real browser/OBS evidence, never only TypeScript compilation.
- Keep the package small and independently consumable; do not absorb Stagehand or SketchyChat-specific concerns by default.

- Emote Wall now composes independent Material, Color Treatment, and Edge Finish axes: `src/wall-aesthetics.ts` validates axis names, and `src/wall-style-packs.css` combines CSS filter variables on the intrinsic-alpha artwork. Keep material pack lifecycle independent of the color/edge attributes. Never introduce a monolithic fixed theme or a second message renderer; default combination must be visually unchanged. Expose new axes through options/OBS URLs/presets and verify *simultaneous* application with real browser computed filters as well as layout, source loading, and cleanup. Native OBS CEF GPU performance remains a separate check.
- Emote-wall material packs are view-specific; original is default and Cut Paper, Ink Wash, and Holo Foil are opt-in CSS/SVG alpha-aware treatments. Keep style switching independent of Chatbus, scene admission, motion, Constellation and cinematic effects. Ink Wash mounts one uniquely identified, bounded SVG filter per wall, unmounted on style change/disposal; Holo Foil likewise owns one disposable per-wall filter resource; no extra RAF/tickers or remote scripts. The shared local style registry is in `src/style-pack-registry.ts`. Unit-test resource isolation, compositor behavior, and browser-size appearance. See `docs/wall-materials.md`.
- Presentation extensions: `src/style-packs.ts` is a small trusted local registration/lifecycle contract. Built-in chat styles `plain`, `paper`, `phosphor` ship as scoped CSS in `src/chat-style-packs.css` and are exposed as one Chat option. Styles must never own transport, admission, moderation, or message DOM. No arbitrary remote plugin JS/CSS/HTML. Disposer runs on style switch/unmount and must not leak timers/DOM; preserve existing opacity behavior including alpha 0. `docs/style-packs.md` documents the integration contract and limitations; explicitly validate appearance in browser at OBS sizes.
- Chat layout modes share one Chatbus-fed scene: Vertical Stack (default), Horizontal Strip (side-by-side message cards with newest visible right), Latest Only (single active message). Each mode supports a shared identity/header and body; Inline can optionally flow both on one line, while Floating keeps its top-edge label separate. Chat message and text alignment are independent; top stacks newest-first and bottom newest-last. Strip removes fully clipped rows in a batched RAF with ResizeObserver cleanup; preserve the configured max when returning from Latest Only. Layout is one declared Chat option, never a second transport. Verify URLs/editor and actual browser at narrow OBS dimensions; do not claim native OBS CEF testing without performing it.

<!-- meristem:start -->
## Meristem project continuity

The private development workspace uses Meristem project state. Public source snapshots intentionally omit internal records; the rules below apply only when those records exist.

Before non-trivial work:

1. Treat current repository/runtime evidence as the authority for what exists now.
2. Read `.meristem/PROJECT.md` for durable project purpose, invariants, and architecture boundaries when relevant.
3. If `ACTIVE_WORK.md` exists, read it for the current objective, locked decisions, constraints, verification state, and unresolved uncertainty.
4. Consult `.meristem/DECISIONS.md`, `LEARNINGS.md`, `ERRORS.md`, or `FEATURE_REQUESTS.md` only when they can materially change the current task.
5. Do not promote session detail into durable files merely because it is recent. Persist consequential state before dependent continuation when losing it would make later work expensive or misleading.
6. Preserve existing project conventions and working state. Do not broadly rewrite configuration or clean up unrelated code for convenience.
7. Verify user-visible outcomes before claiming completion.
8. Treat canonical `.meristem/*.md` files and `ACTIVE_WORK.md` as commit-safe repository knowledge. Keep secrets, personal continuity, raw conversations, and machine-specific state out of them; use `.meristem/local/` only for repo-local private/machine state.

Use the narrowest capable tool or specialist. Current source and runtime truth outrank stale continuation notes.
<!-- meristem:end -->
