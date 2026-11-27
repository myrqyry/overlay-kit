# Chat commands and channel-event overlay triggers

Overlay Kit supports **opt-in**, independent event/command rules for **Chat** and **Emote Wall**. Rules use the existing ChatBus message and social-event feeds, without additional provider connections, script injection, or changes to moderation.

## Configure and test

1. Open Chat or Emote Wall in the control room and expand **Triggers**.
2. Click **Load examples** or enter your own rules, one per line. No effects are active by default.
3. Click **Test command** or **Test channel event**; these send explicitly synthetic events only to that enabled preview.
4. Copy the browser-source URL or save a preset. Rules are view-specific and hot-update without reloading or clearing the scene.

## Syntax

    !hype -> confetti @mods 6s
    !rain -> rain @any 5s
    raid -> spotlight 8s
    subscription -> holo-foil 7s

Format: trigger -> effect [@permission] [duration]. Each rule lasts 2–12 seconds (6s by default); 12 rules maximum. Comments starting with # are ignored. Invalid lines are dropped and counted in the editor. Commands are exact leading tokens (case-insensitive), not arbitrary substring matches.

**Permissions:** @mods is the default and accepts normalized moderator or broadcaster roles; @broadcaster restricts to broadcaster/owner; @any explicitly allows everyone. Cosmetic badges and untrusted chat text do not grant permissions. On providers without reliable staff role information, staff-only commands may not match. Use @any only when a public command is intended.

**Supported channel events:** follow, raid, subscription, gift-subscription, cheer, donation and reward-redemption, when the connected ChatBus provider actually emits them. No absent provider capabilities are fabricated.

## Effects

| Name | Available on | What happens |
|---|---|---|
| pulse | Both | Animated ring and subtle emphasis on the existing content |
| confetti | Both | 22 bounded, seeded particles |
| glitch | Both | Brief scanlines, split-light effect |
| spotlight | Both | Animated center vignette |
| rain | Both | 18 blue falling streaks |
| paper, phosphor | Chat | Temporarily activate existing local Chat styles |
| holo-foil, ink-wash | Wall | Temporarily activate existing local wall material packs |
| bounce | Wall | Temporarily use the existing Bounce motion mode |

All effects restore the **latest configured base style or motion** on expiry, supersession, clear or disposal. Only one active cue is displayed per browser source. Presentation mounts as a pointer-events-none sibling to the view and never changes message IDs, lifetimes or moderation behavior.

## Golden-ratio motion tuning

Triggered effects now share a **measured arrival → hold → release** sequence. This is a visual art-direction heuristic, not a claim that phi is inherently optimal for motion. Timing uses phi = (1 + sqrt(5)) / 2 (about 1.618): a 6-second cue gets approximately **334 ms to arrive** and **540 ms to release**, with the remaining time left for the content. A two-second cue has a shorter 220 ms arrival and 356 ms release. Timing comes from the pure helper src/golden-motion.ts; the ChatBus trigger director still owns the sole logical cue timer.

- Confetti and rain use **golden-angle spacing (about 137.51 degrees)** and a low-discrepancy horizontal distribution rather than repeatable columns or runtime randomness. Delays, drift, scale, fall durations and repetitions are bounded to the cue lifetime.
- The palette is muted pearl, mint, lilac, rose and pale cyan rather than full-saturation cycling hues. Easing, curved movement, restrained layering and a soft style sweep create hierarchy without taking over existing emote content.
- Emphasis leads at arrival, then makes way for the original chat/emote content; the scene fades out as a cue expires. Each cue builds a **new disposable scene element**, restarting CSS animations even for consecutive copies of the same effect without forcing layout.
- The underlying Chat/Wall animations, message layout, moderation, filters and user-selected base style defaults remain unchanged. Reduced-motion mode keeps a still caption/treatment, hides moving particles, and preserves cue expiration.

## Safety and verification

Message IDs and event IDs are deduplicated; ID-less valid events use a bounded actor/time/source fingerprint. Explicit replay-origin channel events are ignored. Each rule has a per-source cooldown of at least 2.5 seconds or half its duration. Names use textContent, never HTML. There are no external styles, scripts or provider HTTP calls. Reduced-motion settings disable moving particles and flashes. Timer, filter and visual resources are disposed with the browser source.

Automated tests exercise parsing, exact commands, permissions, cooldown, replays, ID-less events, timed cleanup and URL/preset isolation. Chromium tests verified command confetti, raid spotlight, temporary Wall Holo Foil and Chat Phosphor, and automatic restoration without runtime exceptions. Native OBS CEF and actual provider-triggered event sessions remain unverified.
