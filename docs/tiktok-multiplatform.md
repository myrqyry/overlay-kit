# TikTok LIVE in the shared multi-platform mixer — 2026-11-17

Overlay Kit advances its exact Chatbus runtime snapshot to 9bd01a7.
No vendored implementation edits. The host installs the exact
tiktok-live-connector 2.4.0 (MIT; pinned protobuf 0.2.3), not the newer
AGPL version. The existing local HTTP server owns the provider connection;
the browser receives only display-safe events and social signals.
Anonymous external signing is unofficial and may be metered or refused.
No TikTok login or chat-send action, no new service or hosted subscription.

## Use

Run pnpm dev or pnpm live. Choose TikTok from the platform logo menu in the source field
and enter a username, @username or TikTok LIVE URL. Add it with the link
button. Repeat with other platforms; click a source’s chip and choose Disconnect
to remove only that source, or Reconnect to renew it. Each chip displays
its own readiness. See [current editor controls](live-source-field.md). The local source set persists channel
identifiers in the existing configuration, not credentials. An idle
status WebSocket can remain open when all provider sources are removed.

The same mixer scopes message IDs and moderation/clear events to
platform:channel. The chat icon identifies TikTok; the shared event
queue labels known TikTok gifts as gifts (pluralized count when known),
not money donations. This uses Chatbus's existing donation event kind
and event toggle. Follow alerts use the existing follow kind.
No new provider fetches for TikTok badges, emote catalogs, avatars or
account OAuth. Native TikTok emote placement, stickers, roles, likes,
shares and subscriptions remain unimplemented upstream. Chatbus gifts
and follows are covered by decoded payload fixtures rather than a
live gifting/following action. No live gifting or following was performed.

## Hosted boundary

The generated hosted API supports TikTok by default, without additional
environment configuration. OVERLAY_HOSTED_TIKTOK=0 explicitly disables it. Status advertising and upgrade
admission share the same allowlist; the editor disables unsupported
platforms and browser sources skip unsupported rooms. Unsupported explicit
source URLs do not fall back to a different room. The existing same-origin
checks and room/client bounds remain unchanged (default 3 rooms and 12
clients per function instance); no claim that all four platforms can
occupy one hosted instance simultaneously. Local mixing is not subject
to that hosted room limit. The optional signing key is server-only
SIGN_API_KEY; anonymous access worked without one in these checks.
No paid signing credentials, account cookies or new service are provisioned.
Anonymous signing remains subject to external rate limits/refusals. Vercel
dependency tracing and deployed-room behavior remain unverified.

## Evidence

Four initial focused cases failed against the previous three-platform
Overlay Kit. The new coverage validates target normalization via Chatbus,
mixed source URLs, source-scoped clear/removal, display-safe projections,
platform icon, gift wording, HTTP local routing, and actual hosted
WebSocket upgrade admission by default and rejection when opted out. Existing disconnect/reload
regressions remain in the full suite.

Actual production-built editor in Chromium using the existing loopback
server, isolated temporary configuration and public providers, no API key:
- TikTok @tv_asahi_news and Kick westcol confirmed connected simultaneously.
- One local browser feed observed 6 live TikTok and 70 live Kick messages.
- Chat preview contained 6 TikTok badges and 34 Kick badges at inspection.
- Selecting and unlinking TikTok left Kick connected. Kick reached 98
  live messages while TikTok remained at 6; no page exceptions.
- Removing Kick left an empty source set.
- Separately imported the generated api/live.js directly in Node with
  OVERLAY_HOSTED_TIKTOK=1 for that isolated process: actual hosted-room
  WebSocket reached connected, 6 live TikTok messages, no error. This
  is a local generated-function test, not a Vercel deployment.

Reproduce the local smoke with a built app, Playwright installed and
Chrome available. Example from Loam:

```sh
pnpm build
pnpm exec tsx tests/manual/tiktok-mixer-smoke.mts tv_asahi_news westcol
```

PLAYWRIGHT_ENTRY and BROWSER_BIN override local browser tooling. Choose
currently live public channels. No chat text, tokens, or real saved
source settings are recorded; the script owns temporary config and
closes its server/browser. Native OBS CEF, credentialed YouTube chat,
and deployed Vercel behavior remain untested. The working TikTok and
Kick local paths are not dependent on deploying a separate service.

Final clean-install gate: frozen dependency installation, TypeScript,
production build (including generated hosted functions), and 534/534
tests across 97 files passed. The saved browser smoke ran again against
the real providers: six live TikTok messages and 36 live Kick messages;
after removing TikTok, Kick reached 41 while TikTok remained at six.
Both sources were subsequently removed, with zero page errors. The
earlier app-shell assertion was updated to include the new fourth
platform. The saved smoke's dynamic Playwright callback types were
corrected before the final gate.

The default-enabled follow-up corrects the previous opt-in gate. The
production status handler and WebSocket admission use the same default;
explicit host opt-out and room/client bounds are retained.
