# Kick official API credentials and local sign-in

## Verified implementation boundary

Chatbus supports the official Kick OAuth 2.1 authorization code grant with
S256 PKCE, single-use state ownership in Overlay Kit, refresh-token exchange,
and the Kick **app access token** client-credentials grant. The latter is a
server-only primitive, not a token to place in a browser or OBS source URL.

The loopback-only Overlay Kit relay loads the Kick Client ID and Secret from
the owning Linux user's private `~/.config/chatbus/kick-app.json` (mode 0600)
and enables the existing **Sign in / Sign out** button when Kick is selected.
The file must be owner-owned and inaccessible to group/other users. No client
secret is returned by `/api/oauth/status`, included in a preview URL, or
written to the Git repository.

The registered redirect URI is
`http://localhost:5219/api/oauth/callback` for the default local relay port.
On successful state-validated callback, the browser returns to
`http://127.0.0.1:5219/` so its existing same-origin live connection continues
working. If using a different port, the Kick developer app redirect registration
must be updated to match.

Kick sign-in requests only `user:read`, `channel:read`, and
`events:subscribe`. Tokens are persisted by the existing local-only OAuth
manager to ignored `.oauth-accounts.json` with mode 0600. Kick account
connection does **not** automatically replace the read-only, anonymous Kick
realtime source; login and reconnecting chat are independent.

## Still open: official event delivery

Kick's official `chat.message.sent`, follow, subscription and gift events
arrive at a publicly reachable HTTPS **webhook** configured in the Kick
developer portal, not over the OAuth callback. The existing app has webhooks
disabled. Do not enable it without a receiving endpoint that verifies Kick's
public-key signature on the exact raw body, authenticates the event identity,
deduplicates deliveries, and then normalizes the event for Chatbus. App
credentials or a successful OAuth sign-in alone do not supply official chat.

Keep the currently working anonymous Kick realtime integration until that
verified event path demonstrates equivalent behavior. Hosted Vercel account
authorization is not implemented, and an OBS live end-to-end sign-in has not
yet been established.

Official references:
- https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/generating-tokens-oauth2-flow.md
- https://github.com/KickEngineering/KickDevDocs/blob/main/events/introduction.md
- https://github.com/KickEngineering/KickDevDocs/blob/main/events/webhook-security.md

## Shared transport unification (2026-11-17)

Overlay Kit retains the existing server-side anonymous Kick source and
display-safe mixer. Noita and Sketchy now use the same upstream Chatbus
runtime through their existing local Vite server relay; no public webhook
is required for that path. Local OAuth remains optional, independent and
unchanged. The consumer snapshot pinned at that unification was c3c6558;
the current pin (advanced by the TikTok mixer update) is recorded in
vendor/chatbus/UPSTREAM_COMMIT. Recent chat is now explicitly marked
replay rather than live in the shared social-signal contract.

Verified using a temporary local server on loopback, restore disabled,
isolated configuration, and a public live Kick channel. The real
read-only event stream reported upstream connected and projected 24
messages and 24 social signals: 20 replay, four live. No provider
credentials were used. The normal 527 tests, typecheck and build also
passed. Hosted Vercel artifact is regenerated from the actual source;
no deploy or real OBS rendering claim.
