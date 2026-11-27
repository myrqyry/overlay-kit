# Overlay Kit motion controls

Motion is scoped to each browser-source view. Each control is available in its own editor inspector and its corresponding URL/preset. Enter/exit durations are independent where exposed; these are visual transformations, not movement of the document layout every frame.

| Surface | Entrance | Exit | Lifecycle |
| --- | --- | --- | --- |
| Chat bubble | Existing entrances plus Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Split Flap, Fold Collapse | Existing exits plus Blur Out, Curtain Close, Glitch Split, Dissolve, Split Flap, Fold Collapse | Natural expiry retains row until exit completion; moderation deletion is separate/immediate |
| Chat letters | None, Fade, Rise, Pop, Scramble, Slide, Drop, Flip, Twist, Wave, Spring, Drift, Soft Land, Typewriter, Split Flap, Stagger Fade, Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Fold Collapse, Gravity Drop | None, Fade, Sink, Scatter, Slide, Flip, Shrink, Twist | One-shot entrances are capped at 120 graphemes; emotes, media and badges remain intact. Natural expiry waits for final exiting glyph; moderation removes immediately |
| Emote Wall | Existing entrances plus Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Split Flap, Fold Collapse | Existing exits plus Blur Out, Curtain Close, Glitch Split, Dissolve, Split Flap, Fold Collapse, cinematic and color effects | Inner visual handles one-shot entrance/exit; outer entity handles looping path. Natural expiry and capacity eviction use exit; moderation/clear/dispose remove immediately |
| Events | None, Rise, Pop, Sweep, Unfold, Flip, Spring, Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Split Flap, Fold Collapse | None, Fade, Sink, Shrink, Flip, Spring, Blur Out, Curtain Close, Glitch Split, Dissolve, Split Flap, Fold Collapse | Entrance → display hold → exit → next queued alert, or transparent empty state |

## Golden-ratio motion polish for primary Chat and Emote Wall (November 2026)

The golden-ratio treatment initially applied only to **command/event trigger effects**. It now extends to the actual Chat/Emote Wall content motions, preserving all existing option names, saved durations, user-selected effects, live/preview message behavior and ChatBus transport.

- **Wall continuous paths:** Float (default), Bounce, Sway and Flutter retain their specified travel distances and cycle periods while using softer timing and φ-derived path anchors (38.2% and 61.8%). Smaller rotational excursions and less dramatic flutter scale make mixed emotes feel less jittery. Orbit remains **linear** to preserve its intended even circular motion; collision stays governed by its own physics loop, not CSS.
- **Wall entrances/exits:** Popular Pop, Spring, Drop, Fade and Drift now settle or release over the same proportional keyframes; the remaining one-shot Wall animations inherit shared soft entry and departure easing without replacing the more deliberate stepped Glitch effects. The outer moving item and inner image material/filter axes remain independent.
- **Chat bubbles and letters:** Default Rise, the Slide and Pop entrances, Soft Land, Fade and Float Away exits and representative per-letter motions use quieter overshoot/hold proportions. Other ordinary one-shot Chat and letter effects use shared tuned easing. Existing Typewriter/character Scramble timing and DOM visibility remain under their original timer owners; no emotes or media are broken into glyphs.
- **Existing-row reflow:** When manually enabled, FLIP uses a gentle decelerating cubic-bezier curve with the same chosen duration, independent CSS translate and its existing fallback for older CEF environments. The default remains disabled.
- **Reduced motion:** Now also suppresses the **outer perpetual Wall CSS paths**, not just inner emote entrances/exits. Collision physics already has its own reduced-motion contract. Chat row/letter animations and Typewriter continue to respect their separate no-motion paths.

The ratio φ ≈ 1.618 is a composition constraint for timing and path anchors, not a scientifically validated ideal. No new shader, provider API, animation timer or library is needed. Default **motion choices** remain Float for Wall and Rise for Chat, while Wall emote entrance/exit, Chat letter animation and smooth reflow still honor their established disabled defaults.

Verified with focused motion/reflow tests and Chromium at 960×540 for active Wall Float + Pop, active Chat Rise + Soft Land, opt-out and reduced-motion modes. Native OBS CEF remains unverified.

## Context-aware Chat animation durations

In **Chat → Animations**, the timing controls appear immediately beside the
effect that owns them. Their stored values survive temporary hide/show:

- **Message entrance → Entrance duration** appears unless the message entrance
  is None. This adjusts `enterMs` (120–1200ms), controlling the entire bubble
  with its badges and background.
- **Letter entrance → Letter entrance duration** appears unless the letter
  entrance is None. This adjusts `letterEnterMs` (120–1200ms), controlling
  each grapheme's CSS effect or Scramble/Split Flap reveal. Typewriter instead
  maps the duration setting to a 30–110ms per-glyph typing cadence; other
  effects retain the existing 14ms per-letter stagger.
- **Smooth message movement → Movement duration** appears only while smooth
  movement is on. This adjusts `reflowMs` (100–1000ms) for existing chat
  rows being repositioned, not new message/letter entrances.

Message and letter entrances can run simultaneously with **independent
durations**. The defaults are 320ms each. Version-1 presets and older OBS URLs
which previously only had `enterMs` preserve their established letter speed:
when `letterEnterMs` is missing, it inherits the old `enterMs` at import.
The new field is optional in a URL, but is explicitly emitted when necessary
to distinguish a default 320ms letter duration from a customized message
entrance duration. Disabling any effect hides its timing control without
deleting the value from saved settings.

## Text animation specimen adaptations

Nine one-shot chat entrances were adapted from the [Text Animations specimen gallery](https://codepen.io/web-strategist/pen/dPNmvGo): Typewriter, Split Flap, Stagger Fade, Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Fold Collapse, and Gravity Drop. Similar existing effects (including Scramble, Flip and Wave) were not duplicated. These are local CSS and bounded per-grapheme presentation effects, not external script dependencies. **Typewriter layout and continuity:** unrevealed graphemes *and spaces* are removed from layout until their turn, rather than hidden with opacity while reserving line width. This prevents empty gaps and premature wrapping of later words or compact links. One bounded row timer reveals each grapheme at the selected 30–110ms cadence and moves the zero-width blinking caret with it. When a new chat arrives, older Typewriter rows keep progressing independently, including during smooth reflow. Timer ticks catch up after browser throttling; expiry, moderation, and disposal clean up the timer/caret. The exported standalone renderer leaves all text visible until a ChatFeed actually owns the animation. Reduced motion reveals everything without the cursor. Split Flap shares Scramble's capped timer/reveal lifecycle, including cleanup on expiry, moderation, and disposal. Hover-, cursor-, scroll-, indefinitely looping, text-changing, and canvas-driven demos are not imported into unattended chat; those would require separately owned controls and lifecycles.

## Emote Wall: image-adapted text entrances

Six one-shot entrances adapt the earlier Chat text animation vocabulary to full layered emote artwork: **Blur Focus**, **Curtain Wipe**, **Glitch Split**, **Dissolve**, **Split Flap**, and **Fold Collapse**. They are selectable in **Wall → Movement → Emote entrance**, saved in presets and encoded by the existing `wallEnter` URL key, for example `wall.html?wallEnter=glitch-split&motion=orbit`.

These effects animate the outer `.overlay-wall-visual` while preserving the existing intrinsic-alpha emote (including overlays) and its composable Material / Color Treatment / Edge Finish filters on child artwork. They do not create additional fragments, canvas surfaces, loops, or timers. Transient blur, clipping and chromatic ghosting clear after the entrance; reduced-motion disables animations. Entrance effects apply to newly admitted emotes, while already-visible emotes and continuing motion remain in place when the editor changes settings. Chorus-added copies still use their existing Pop behavior.

Gravity Drop and Stagger Fade were not copied into Wall: the existing Drop / Impact effects already cover the former, and the latter is more meaningful as a separate group/Chorus choreography. Typewriter has no useful single-image analogue. The new Dissolve is a brief hazy image entrance rather than a particle simulation. Native OBS CEF performance remains unverified.

## Emote Wall: Collision motion path

**Wall → Movement → Motion path → Collision** is an opt-in physics path (`motion=collide` in a Wall source URL). Emotes travel with seeded momentum, bounce off each other's **rendered rectangular footprints** (rather than expensive alpha/pixel-perfect masks), and rebound from the OBS canvas edges. **Motion speed** changes their velocity; **Travel distance** applies only to the pre-existing looping CSS paths. The default Float **selection and distance/speed controls** remain unchanged; its CSS easing/path interpolation have been softly tuned as described above.

Collision uses one bounded animation-frame owner per Wall and only the outer sprite's independent CSS `translate` property. Existing one-shot entrances/exits and layered Material / Color Treatment / Edge Finish effects remain independently animated. Collision gives way to Constellation while its field is selected; switching paths removes physical offsets. Natural expiry freezes the last collision position until the separate exit finishes, whereas moderation, clear, and disposal remove immediately. Reduced-motion stops collision movement. Sprites are sized from their actual rendered proportions; crowded scenes may still temporarily overlap, and physical response is intentionally approximate rather than pixel-perfect. Native OBS CEF performance is not yet verified.

## Whole-message and wall natural exits

The matching **Chat → Animations → Message entrance** selector now offers six full-bubble adaptations of the earlier text animations: Blur Focus, Curtain Wipe, Glitch Split, Dissolve, Split Flap and Fold Collapse. They animate the complete message, including badges, emotes and background, without splitting graphemes. They use existing `enter` / `enterMs` URL and preset fields; letter entrances remain independently configurable.

Both **Chat → Animations → Message exit** and **Wall → Movement → Emote exit** now offer Blur Out, Curtain Close, Glitch Split, Dissolve, Split Flap and Fold Collapse. These use existing `exit` / `exitMs` and `wallExit` / `wallExitMs` fields. Each exit runs on natural expiry or applicable capacity eviction and keeps the item in place until its matching animation completes (or its bounded CEF fallback deadline). Moderation, clearing and disposal continue to detach original chat/emote content immediately. Wall exits affect complete layered alpha artwork, leaving ongoing paths and composite artwork treatments independently owned. No additional script animation loops, DOM fragments or timelines are added.

These are one-shot, image/message-level versions rather than word/letter animations; Typewriter, Stagger Fade, and Gravity Drop are omitted because whole-message versions either lose their purpose or duplicate existing Drop/Impact. For the separate **Letter exit** selector, an explicit non-None choice continues to override the whole-message exit during expiry, as it did before this expansion. Reduced-motion skips the visual effect. Native OBS CEF stress/performance remains a separate verification boundary.

## Events: final alert still exits

`eventDuration` sets display hold in seconds (default 6); after that deadline the card starts `eventExit` (default `fade`), regardless of whether another event is waiting. `eventExitMs` sets exit time in milliseconds (default 300, range 100–1500). Once the exit completes, the queue advances; if nothing remains, the OBS browser source is transparent. Arrivals during an exit queue normally. `eventMotionMs` sets the one-shot entrance duration (default 340, range 100–1500) and is hidden when the entrance is None. `eventAccent` and `eventFamily` change only the alert's color and typeface. Type and tier rules can replace the appearance, accent, typeface, entrance/exit choices and durations, or text size for one event kind or one provider subscription tier; see [event overrides](event-overrides.md). `eventExit=none` or reduced motion bypasses the exit. Clearing or disposing removes cards immediately and cancels both timers. The completion deadline is bounded so lost `animationend` events cannot strand alerts.

Example source URLs (illustrative parameters only):

- `chat.html?enter=wave&exit=twist&letterEnter=spring&letterExit=flip`
- `wall.html?wallEnter=spring&wallExit=flip`
- `events.html?eventMotion=flip&eventExit=fade&eventExitMs=300`

Animations are implemented in `src/chat-motion.css`, `src/wall-motion.css` and `src/events.css`, with their existing lifecycle owners in `src/chat-motion.ts`, `src/wall-motion.ts` and `src/events.ts`. Keeping these owners separate avoids conflicting transforms and prevents event animations from changing chat or wall admission semantics. Actual OBS CEF behavior and stress performance remain unverified.
