# Preview cosmetics from prior Chatbus sessions

The Overlay Kit control room can reuse genuine **emote artwork, badge artwork, and sanitized 7TV name paints** in its explicitly synthetic preview chat. The rendered sample messages keep fictional names and chat text; no provider message is replayed as if it were a new viewer message.

## How it works

- While the **control room is open**, its existing read-only Chatbus WebSocket listener observes projected messages, late badge patches and late 7TV identity/paint updates. It does **not** open an additional provider connection. The local relay already replays up to 50 current normalized messages when a client connects, so opening the editor can recover visual samples from that relay session.
- The browser stores up to **32 distinct visual bundles** in the editor origin's localStorage, keyed by a versioned cache name, with a 150 KB serialized cap and a **30-day idle expiry** (measured from the latest write). Repeated identical bundles do not cause additional writes. The stored data includes safe HTTPS/local asset image URLs, bounded badge metadata, projected paint styles and emote metadata.
- The cache **does not store** original chat text, message IDs, user IDs, usernames or room names. It replaces viewer/channel avatar badge labels with generic labels; **some external avatar URLs can still encode public account identifiers**, and the browser fetches those URLs from their providers when shown. The metadata cache does not download or persist actual image bytes. The browser's usual HTTP cache may keep images independently.
- Sample cards select distinct available live cosmetics preferentially, rather than reconstructing an actual conversation. If there are no real cached paints, **synthetic preview-only gradient and layered paints** exercise the name-paint renderer; bundled SVG badges/emotes remain the offline fallback.
- The inspector shows **cached visual sample**, emote, badge and paint counts. **Clear cached art** removes only this cache and refreshes synthetic iframe fixtures without disrupting live chat, existing settings or other overlays.

## Scope and limitations

- Previously observed messages from **before this feature was installed** cannot be recovered unless the existing relay still retains them. Caches are browser- and origin-specific, so changing host/port or OBS browser profile does not share the data.
- Live Chatbus remains authoritative; sample profile caches never manufacture provider badges, user entitlement claims or a live stream connection. Hosted sources only contribute to the asset library when their WebSockets actually deliver data to the open control room.
- The cache reuses verified upstream-resolved visual metadata. It does not perform independent Twitch/7TV API lookups, and outdated/deleted CDN image URLs can stop loading; clearing the cache or observing newer live data replaces them.
- Individual recent messages removed by moderation have their currently tracked sample records removed. Entries stored before this browsing session are anonymous style/URL records and cannot always be tied back to a later moderation event. Clear cached art for full local removal.

## Verification

Unit tests: `tests/preview-asset-cache.test.ts` (persistence, late paint updates, deduplication, source removal, unsafe links, lifetime and storage failure). Browser smoke tests through Chromium verified genuine-replay capture in the control room, isolated asset-backed preview rendering, painted username CSS, badge/emote image sources, and cache clearing. Native OBS CEF remains untested.
