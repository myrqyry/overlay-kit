# Overlay Kit chat style packs

Style packs are a **presentation layer**, not separate chat overlays. The
Chatbus adapter, admission/expiry scene, moderation, layouts, emotes, and
animation lifecycle remain owned by Overlay Kit.

## Shipped packs

- `plain` (**Classic**) — preserves the original chat rendering, default for
  existing URLs and saved presets.
- `paper` (**Paper**) — subdued notebook paper, pencil borders and decorative
  grain without an additional frame around emotes.
- `phosphor` (**Phosphor**) — restrained analog-terminal green on deep warm
  charcoal with subtle static scanlines. No infinite flicker animation.

In Studio open **Chat → Style pack**. An OBS source accepts
`/chat.html?style=paper` or `?style=phosphor`, independently of
`?layout=strip` or `?layout=spotlight`. Saved settings, URL generation,
import/export and per-view scopes use the existing options manifest.

Styles are scoped to a scene root via `data-chat-style`. Selecting a style
never reparses messages, reconstructs active rows, restarts Chatbus or owns
expiry timers. The default `plain` layout has no new visible effects.
Built-in styles preserve message-background opacity, including 0%. Their authored paper/phosphor fills apply only when **Message background source = Theme**. User color and Name paint backgrounds replace the pack fill while retaining the pack typography/shape details; name paints, emote layers, badges and the chosen font still work.

## Trusted extension contract

`src/style-packs.ts` exports `ChatStylePack`, `registerChatStylePack`,
`applyChatStylePack`, `getChatStylePack` and `listChatStylePacks`.

An application with **trusted local code** can register an idempotent,
uniquely named style and attach any extra lifecycle-bound decoration:

```ts
import { registerChatStylePack } from '@myrqyry/overlay-kit';

const unregister = registerChatStylePack({
  id: 'custom-ink',
  name: 'Custom Ink',
  description: 'Hand-painted accents',
  mount(root) {
    root.classList.add('custom-ink');
    return () => root.classList.remove('custom-ink');
  },
});
```

The host must import any authored CSS explicitly and apply the registered
style id through `createChatFeed({stylePack: 'custom-ink'})` or
`feed.configure({stylePack:'custom-ink'})`. Cleanup is called exactly once
when switching away or disposing the feed. Style IDs are validated and
unknown IDs fall back to `plain`.

**Boundary:** registration is deliberately **not** a remote-plugin loader,
a sandbox, or a marketplace. Mount hooks have ordinary DOM access and must
only be loaded from code the host trusts. The editor/OBS URL only exposes
the three built-in allowlisted styles; new installed style packages can
extend the editor manifest in a later opt-in packaging flow. Do not run
arbitrary user-supplied JavaScript, CSS, URL schemes or HTML from a gallery.

## Editing built-in packs

1. Define the stable id, name and description in `src/style-packs.ts`.
2. Add scoped rules to `src/chat-style-packs.css`. Avoid global selectors,
   animation loops, or restructuring `.overlay-chat-message`.
3. For built-in editor/OBS selection, add the new id to the typed
   `BuiltinChatStyle` and the allowlist in `src/options.ts`.
4. Preserve `--chat-bg-alpha`, `[data-message-background]`, and 0% behavior. Pack-authored fills should target only `data-message-background="theme"`; do not clobber user-color/name-paint fills, base emote width, moderation, user-selected fonts or motion transforms.
5. Add contract/URL tests, then verify in Chromium in Stack, Strip and
   Spotlight modes and at a narrow OBS canvas width. Actual OBS CEF is
   a separate validation boundary.

For custom hosts, import `@myrqyry/overlay-kit/chat-style-packs.css`.
The bundled Studio and browser sources import the stylesheet automatically.
