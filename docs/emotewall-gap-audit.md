# EmoteWall feature-gap audit (2026-10-22)

Source: [RealityRipple/EmoteWall](https://github.com/RealityRipple/EmoteWall)
at trunk tree `600c6d0c2f7ef4f397a044a5ff0a6d1b37c08561`, primarily `README.md` and `CONFIG.md`.
Comparison target: the **local** OverlayKit worktree after FFZ modifier effects
(`1c66853`) and the opt-in Emote Chorus implementation. This is a design
comparison, not an EmoteWall conformance test or live-provider test.

## What we already have

- Normalized Chatbus emote fragments, BTTV/FFZ/7TV catalogs, stacked/zero-width
  art, FFZ effects, badges, and an emote wall with admission/expiry/moderation.
- Composable Wall material × color × edge treatments and motion/entrance/exit
  settings, including a Constellation field, Echo Print, Shatter and Assemble.
- Independent browser sources, presets and editor, deterministic demo/test
  fixtures, and a loopback live relay.
- **New:** Emote Chorus is **not** an EmoteWall-style general threshold. It uses
  *distinct viewer identities* (three within eight seconds) and produces a
  six-emote bounded visual reaction, off by default, with a per-emote cooldown.

## Evidence-backed gaps and recommended order

1. **Rule-driven event → visual cue mapping (highest impact).**
   `CONFIG.md` lists detailed event rules for raids (including count ranges
   and origin emotes), subscriptions, cheers, rewards, hype trains, polls,
   predictions, follows, and donations, plus platform-specific cases.
   Chatbus's *type contract* includes raid, follow, gift-subscription,
   donation, reward-redemption and hype-train events; however, OverlayKit
   `src/live.ts` currently only projects message/cheer/subscription *with a
   body* and moderation into visual events. The standalone live relay uses
   anonymous Twitch IRC, so many event classes will be genuinely unavailable
   without supported authenticated transports. **Build a narrow, typed,
   source-qualified reaction-rule engine only after real event delivery is
   established; never fabricate events.** Keep it outside Chatbus.
2. **Source/user/emote admission controls.** EmoteWall supports broadcaster,
   mod and subscriber access classes, bot/username ignore lists, local-only
   emotes, and per-message duplicate caps. OverlayKit now has a pure,
   post-normalization explicit username ignore filter for Chat, Wall and
   Avatars; it preserves raw Chatbus events and runs before scene admission or
   Wall Chorus. Role/source classes, automatic bot classification, local-only
   emote rules and duplicate caps remain separate because the current relay
   does not provide enough evidence to infer all of them safely.
3. **General emote rate threshold and bounded queue.** EmoteWall's `emote.threshold`
   triggers one normal appearance per N emotes within an interval, and
   `emote.queue` buffers emotes over capacity. OverlayKit always displays
   each accepted emote immediately and evicts overflow. The new Emote Chorus
   intentionally serves a different purpose. Distinguish backlog policy from
   scene max and never create an unbounded queue.
4. **Named mass-effect choreography.** EmoteWall offers configurable Kappagen
   command/event effects, including Conga, TheCube, and Text (plus contagion
   and screen-middle avoidance). OverlayKit has varied *individual* motion
   and elaborate entrances/exits but no scene-scale command-triggered
   choreography. Favor one bounded choreography prototype rather than a
   full effect port.
5. **Wrap-around and font treatments.** EmoteWall offers toroidal motion
   (moving an emote off one edge and returning at the opposite edge) and
   multiple emoji art sets. OverlayKit does not expose equivalent wall
   controls. Lower priority; some toroidal approaches multiply DOM nodes and
   should be evaluated for OBS CEF GPU/CPU cost.
6. **Authenticated platform/event coverage.** EmoteWall supports richer Twitch,
   Kick, YouTube and tip service integrations. OverlayKit now exposes both
   Chatbus Twitch anonymous IRC and Kick's negotiated public web-realtime chat
   transport, but authenticated Twitch EventSub, authenticated Kick API events,
   YouTube and tip-service relay coverage remain separate. Broaden
   intentionally via real adapters and scopes, not by copying
   a browser-side OAuth token-refresh design.

## Deliberate non-goals

- Do **not** copy the one-file application architecture or assume a preset
  wizard is missing: OverlayKit already has a typed option manifest and editor.
- Do **not** absorb this feature policy into Chatbus: it owns observable
  transport/normalization, not presentation effects.
- Do **not** assume every Chatbus event type is delivered by the anonymous
  Twitch IRC relay; event types alone do not prove source support.
- Do **not** pursue unrestricted OAuth/browser refresh-token storage or
  unlimited emote queues for parity.
- Native OBS CEF, real multi-platform credentials, and sustained high-volume
  performance still need explicit end-to-end verification.

## Practical next cutting

A **small rule engine** accepting validated source-qualified Chatbus-derived
signals (after authentic transport evidence is confirmed), producing bounded
`ReactionCue` records interpreted by OverlayKit. Begin with one genuinely
supported event (e.g., a known cheer) plus deterministic replay tests; allow
explicit rules/cooldowns but don't implement every upstream event at once.
Keep rules visually independent of wall style and transport.
