# Overlay chat links

OverlayKit's OBS browser source isn't an interactive browser. Full-length
URLs crowd out messages, obscure nearby emotes and make a narrow overlay hard
to read. Link display is a presentation choice only, not a Chatbus transport
or normalization change.

Open **Chat → Content → Link display**:

- **Compact** (default): `https://www.youtube.com/watch?v=ID&utm_source=chat`
  is displayed as `↗ youtube.com/watch`. For paths, the first segment is
  kept and deeper segments are abbreviated. Query strings and fragments are
  omitted from the visible token.
- **Domain only**: display `↗ youtube.com`.
- **Hide URL**: display `↗ link`.
- **Full URL**: display the untouched original text.

The choice is stored in Chat presets and OBS source URLs as `links`; the
default is omitted. It does not affect Emote Wall or other sources.

## Boundaries

Only HTTP(S) and `www.`-prefixed URL candidates are shortened. Malformed
candidates, email addresses, unsupported schemes, and userinfo URLs are left
as plain text. The renderer uses text nodes and span elements, never HTML
interpolation. The original literal URL remains in
`data-original-url` and the element's tooltip, but it is not clickable and
does not fetch a remote preview. Copying the displayed label copies the
shortened label; choose Full URL to display/copy the original text.

URL recognition runs before `@mention` coloring, so `@names` in URL
paths and query parameters are not falsely treated as mentions. Existing
provider emotes, Unicode emoji, structured mention fragments, letter motion,
and the message's original normalized fragments remain otherwise intact.

The implementation stops shortening after 12 URL tokens in a single message.
Remaining content stays literal. When message and letter entrances are both
enabled, both layers animate independently; URL tokenization does not
change the bubble animation lifecycle.
