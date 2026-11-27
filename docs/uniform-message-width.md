# Uniform message width — 2026-11-17

Chat → Layout → Max message width sets the cap; Uniform message width
makes every bubble fill the effective cap rather than shrink-wrap.
Default off preserves existing appearances and URLs. Zero max is
inactive even when the preference is on. Existing strip max (68% / 560px)
and Latest Only max (760px), canvas padding, and responsive limits still
apply. Text wraps without scaling the font; message and text alignment
stay independent. No transport, renderer duplication or new dependency.

The single options manifest persists the preference in chat presets,
editor state and OBS URLs (uniformMessageWidth=1). The feed owns a
root dataset switch and CSS width, so directly configuring it does not
replace rows, reset TTL or introduce new timers.

Verification: the two new deterministic tests first failed, then passed.
536 tests across 97 files, typecheck and production build passed.
Actual Chromium geometry in the built pages with labeled synthetic
messages: 240px cap, short inline 69px / floating 95px when off,
all rows exactly 240px when on for Stack, Horizontal Strip and Latest
Only. 320px canvas with 10px padding and 600px cap produces 300px rows;
zero cap stays natural. The real editor toggle changed the current
preview bubble from 69.33px to 240px and back, with no page exceptions.
The first editor probe needed to open the collapsed Layout section via
the existing settings search. No native OBS CEF run.

Reproduce with pnpm build and pnpm exec tsx
tests/manual/uniform-width-smoke.mts (Playwright and Chrome available;
PLAYWRIGHT_ENTRY and BROWSER_BIN override the local paths). No live
provider connection or settings from the user's actual browser.
