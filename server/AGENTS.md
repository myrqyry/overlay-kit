# Local Chatbus relay — invariants

- Local server: read-only WebSocket, binds to 127.0.0.1. Do not silently expose local control on 0.0.0.0.
- Hosted `server/hosted.ts`: Vercel supports WebSocket Functions. A hosted source accepts validated per-URL public Twitch, Kick, YouTube or TikTok targets and defaults to the configured `OVERLAY_TWITCH_CHANNEL`/`OVERLAY_CHAT_PLATFORM`; no anonymous global connect/disconnect mutation. TikTok is advertised by default and `OVERLAY_HOSTED_TIKTOK=0` removes it from the status/admission allowlist. Bound each function instance to a small number of distinct rooms and total clients, and never broadcast events across rooms. Accept same-origin upgrade requests, cap per-instance clients, bound buffered output, close upstream when empty and tolerate function-instance turnover. Do not presume global room state is shared between functions. `server/entries/status.ts` (generated as `api/live/status.js`) is capability/status metadata, not a confirmed provider join.
- Chatbus owns Twitch IRC socket parsing, platform normalization, reconnection and provider catalog; adapter projects only display-safe data. Never broadcast wire/raw fields or credentials.
- YouTube source: official authenticated API remains preferred; credential-free public InnerTube is a Node-only, unofficial fallback unless `OVERLAY_YOUTUBE_PUBLIC=0`. Never inject tokens into URLs or browser packets; preserve source ownership and cancellation.
- Anonymous Twitch IRC is an undocumented compatibility path, not equivalent to OAuth EventSub. Keep status semantics honest: a started process or opened WebSocket is not a confirmed subscribed chat.
- The browser controller is not the owner of the connection; the server is. Source pages must continue receiving after the editor closes.
- Distinct connections require explicit ownership and lifecycle; stale callbacks/catalogs must not modify newly selected channels.
- Origin-check control POST routes and read-only WebSocket upgrades, enforce input size and channel validation, and preserve loopback isolation.
- Moderation deletions/clears must reach every source, and user content must only be rendered with safe text/URL DOM operations.
- Integration tests should use genuine Chatbus parser/normalizer data and a real localhost HTTP/WebSocket stack, not fake successful behavior in production.
- Configuration persistence is channel-only, gitignored, no bearer tokens or OAuth secrets; no Docker.

## Badge catalog boundary
- Anonymous IRC gives Twitch BadgeRefs (set/version). Reuse Chatbus resolveBadgeRefs, never synthesize images from badge IDs.
- Preserve each catalog badge's real 1×/2×/4× image candidates; the client-facing
  projection in `server/hub.ts` picks the largest supplied rendition via
  `src/badge-images.ts`, never inventing missing CDN variants. Direct
  Chatbus messages use that same selection. Keep badge geometry independent
  from chat emote geometry, and preserve non-square provider icons.

- The legacy Twitch badge host shut down in 2023. Public IVR global and channel?id=room-id catalogs are an optional third-party dependency, not an official Twitch API. Restrict URL hosts, request size, retries and cache expiry. Never block chat if badge assets fail.
- Late catalog arrivals must patch existing rows without re-rendering or resetting TTL, and must never resurrect moderated/expired rows. Keep raw IRC data and OAuth secrets out of the browser. Native Twitch badges differ from third-party user-supporter cosmetics.

## Provider-neutral presentation enrichments

- Preserve Chatbus platform/traits/roles/replies/mentions, emote-provider metadata, user badge and name-paint identity; do not parse these again from raw source strings.
- BTTV/FFZ/7TV user cosmetics must call Chatbus's exported identity APIs. Fetch at bounded concurrency with coalescing, caching and a queue cap. Do not block live IRC messages or create one uncontrolled request per message.
- A typed cosmetics response can fail or be missing per provider; never invent provider artwork or claim enrichment success. Kick `subscriber` / `sub_gifter` refs are an exception only in presentation form: bounded `SUB N` / `GIFT N` semantic labels may preserve authenticated role/count metadata until verified artwork exists. Authentic late subscriber art replaces the semantic subscriber label in-place. Track late updates by unique message identity and ignore old-channel/removed-message completions.
- Reuse Chatbus's SocialSignalV1 as the second wire stream for alert/widget consumers; Events renders supported kinds without pretending raids/follows/hype-trains are chat-message rows.
- Name paint rendering may use safe numeric gradient/shadow subsets; never evaluate provider-supplied CSS, raw image URLs or HTML to render cosmetics.

## Google Fonts loading boundary

- Google Fonts catalog names are immutable user-choice metadata bundled under public/google-fonts.json. Only the audited updater script may refresh it; no downloaded font binaries are checked into the repo.
- CSS2 URLs must be built from validated family names. On the local font proxy, allow only families found in the bundled catalog and only Google Fonts CSS2 / fonts.gstatic.com source URLs. Never accept an arbitrary upstream URL supplied in an HTTP request.
- Bound actual streamed response bytes and cache memory, not merely the upstream Content-Length header; don't bypass restrictions to make a rejected font seem supported.
- OBS browser sources must be able to render with localhost HTTP access alone when the host server can fetch fonts. Keep font selection in versioned preset/query state and the renderer neutral to Chatbus.
- On upstream outage, show system fallback rather than pretending that selecting a CSS font-family proves the webfont is available. Google CSS2 is official; the font catalog endpoint is a separate undocumented website data source.
