# Unified live source field

The editor uses one rounded field with a platform logo and persistent dropdown chevron,
provider-specific input placeholder, and embedded right-hand link/unlink
action. A tinted 48px selector segment, divider, and chevron (flips when open) communicate that the platform is switchable without adding a text label. The chooser shows platform logos and names, with a checked current
choice and disabled unavailable platforms; arrow keys, Home/End, Escape,
Enter/Space and outside dismissal are supported. The hidden provider
select remains the single selection backing for existing studio logic.
Reuse the chat platform icon renderer for chooser and source chips.
Source chips restore the corresponding draft. Platform account authorization is managed independently.
The initial field redesign did not change Chatbus, relay protocol, hosted
source persistence, or OBS rendering. Subsequent connection actions are
described below. Connect is disabled until a supported, valid target is present.

Initial field verification (historical): new unit tests and updated workspace shell test; 546 tests
across 98 files, TypeScript and production build. Actual built editor
Chromium smoke through a real isolated local HTTP/WebSocket hub with
synthetic provider fixtures: 1440/1024/390px viewport widths, field widths
253/201/308px, input widths 219/167/274px, menu 158px, no horizontal
overflow, no overlapping input/action hit area. Menu selection,
contextual placeholders, Enter, source-chip restoration, add/remove
Twitch and TikTok independently; both fixture handles closed, no page
errors. Initial browser probes needed fixture selector adjustments for
the new nested platform badges and a tsx-generated helper in page
evaluation; final smoke passed. No actual provider joins or native OBS
testing in this UI-only change. Earlier live mixer smoke updated to
select platforms using the new menu; not rerun against public providers.

Reproduce: pnpm build then pnpm exec tsx
tests/manual/live-source-field-smoke.mts with Playwright and Chromium
(PLAYWRIGHT_ENTRY and BROWSER_BIN override paths).

Discoverability follow-up: 546 tests, production build and the same Chromium smoke passed. The chevron is visible and flips on open, with no overlaps at 1440/1024/390px. Input widths at that checkpoint were 198/146/253px respectively.


## Per-source readiness and context actions

The header no longer has aggregate readiness icons. Each configured chip
owns connection, emotes and badges indicators with individual state colors,
accessible descriptions and tooltips. Click or right-click a chip, or press
Enter/Space/ArrowDown, to open its Reconnect / Disconnect menu; selection
still restores the source field. Keyboard dismissal and navigation work;
keyed chips retain their DOM identity during readiness changes. The
compact source row scrolls horizontally when necessary.

Local mode uses the server's per-source status array and a same-origin
POST /api/live/reconnect operation. Reconnect removes and restarts just
the specified existing source; absent sources return 404. Other provider
handles stay open. Hosted mode uses one status subscription per selected
room and reconciles keyed subscriptions in editor and existing same-origin
preview iframes (without reloading unrelated previews). Hosted Reconnect
reattaches this editor's five room subscriptions; the server may retain
the shared upstream room, and independently opened OBS sources are not
forcibly restarted. Hosted Disconnect removes only this editor's selected
room, updates links and persists the selection; empty remains empty on
reload. Existing public room/client limits are unchanged.

Verification: 549 tests across 99 files; TypeScript and production build.
The real local loopback HTTP/WS and built Chromium editor, using isolated
provider fixtures, restarted Twitch while leaving TikTok open, then
disconnected each by menu. The real hosted-room server and built editor
reported distinct per-room emote readiness (YouTube ready, TikTok
degraded), replaced all five TikTok sockets without replacing any of the
five YouTube sockets, removed each source independently and stayed
disconnected on reload. Shared upstream TikTok remained open during the
reattach, consistent with the hosted boundary. Both browser smokes had
zero page errors. No provider traffic or deployed Vercel verification
in this change. Reproduce with pnpm build and:
- pnpm exec tsx tests/manual/live-source-field-smoke.mts
- pnpm exec tsx tests/manual/hosted-source-chips-smoke.mts

## Platform accounts

The former ambiguous "Local only" / "Read only" button is removed from
the chat-source strip. The person icon in the global toolbar opens a
native accessible Accounts dialog showing all four platforms, their
actual authorization/transport boundaries, local configuration and
connection status, and explicit sign-in/sign-out where available.
Local status is fetched only when the panel opens, not on every source
selection. Hosted and preview modes explain why authorization is
unavailable rather than offering disabled actions. The existing OAuth
server endpoints and token ownership are unchanged. OAuth callback
results reopen Accounts with a success/failure message. No credentials
are exposed or changed by merely opening Accounts.

Verified with local and hosted built Chromium smokes using isolated
provider fixtures, including dialog fit and Escape at 1440/1024/390px,
no horizontal overflow, and unchanged source add/reconnect/remove.
The source field gained 64px of usable width at all three sizes; the
subsequent header layout retains field widths 317/265/372px and input
widths 262/210/317px at 1440/1024/390px respectively.
Hosted mode offers no account mutation actions. Unit tests cover
local configuration, sign-in routing, sign-out isolation and failed
status reads. Real third-party account authorization was not performed.


## Header workspace controls (2026-11-17)

The main preview area contains just the preview grid, without the previous
preset toolbar, external-link action or browser-source footer. Presets
opens a header-accessible dialog for the selected overlay with labeled
Load, Save, Delete and Reset defaults actions. Reset uses a circular
arrow and explicit confirmation; cancellation leaves edits untouched,
and confirmation affects only the selected overlay, keeping named
presets. The main header also hosts the four-panel comparison toggle
and mobile settings access.

Hover Wall, Chat, Avatars or Events (tap on touch, or press Down arrow on
a focused tab) to reveal a compact Enabled switch and Copy link action.
There is no permanent copy-link row. Copy actions use their existing independent
generated browser-source URLs; regular activation copies the URL and
shows Copied only after the clipboard operation succeeds. Modifier-click
and native link context menus retain direct source access. A rejected or
unavailable clipboard shows a selected URL for manual copying. Preview
fixture flags are not included in copied links.

Production Chromium smoke verified header and dialog geometry at
1440, 1024, 800, 390 and 320px widths, all four native clipboard writes
and a denied-clipboard fallback, one/four-pane switching, mobile settings
access, named preset save/load/reload, and canceled/confirmed reset
without changing the other overlays. Zero page errors. No real account
or OBS changes. Reproduce with pnpm build and pnpm exec tsx
tests/manual/header-workspace-smoke.mts.

The editor remembers each preview enable state in local browser storage
(all enabled initially to preserve existing workspaces). Disabling a
preview navigates its iframe to about:blank, releasing its renderer and
live subscriptions; edits remain available, and enabling it loads the
latest settings. Compare omits disabled previews. If all are disabled,
Compare shows an empty state. Independent OBS browser-source URLs and
relay connections are unaffected; the editor status monitor remains
connected. Enabled preview state is a local runtime preference, not a
preset or OBS URL setting.

Chromium verified hover geometry at 1440/1024/800/390/320px, all four
clipboard actions, keyboard and touch access, persistence across reload,
editing while suspended, all-disabled comparison and fresh resume. The
hosted fixture test measured 5 to 4 to 5 subscriptions for one disabled
then enabled preview, retaining the other four sockets.

Final release gate: 554 tests across 100 files, TypeScript, production
build, and built editor header, local source, and hosted source smokes.
The connection smokes use isolated provider fixtures, not live accounts
or deployed Vercel/OBS.
