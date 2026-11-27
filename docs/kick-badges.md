# Kick badge presentation

Overlay Kit consumes normalized identity through Chatbus. Real provider-supplied
image URLs remain the first choice; the renderer never invents provider art.

- Native image-backed badges render directly from their resolved URLs.
- Semantic role refs render as compact, accessible text: MOD, VERIFIED, SUB N,
  and GIFT N. This works with no optional files, network lookup or guessed roles.
- Authentic subscriber milestone art may arrive later and replace only its own
  text badge, without replaying the row or resetting the message lifetime.

## Automatic role artwork (connection-time)

When Kick connects, the local or hosted relay starts Chatbus's existing
`createKickBadgeCatalog().loadChannel()` flow. Chatbus owns discovery,
validation, caching and exact role resolution across consumers. It reads Kick's
public channel HTML and referenced design-system JavaScript assets, extracting only the named static SVG bodies for `ModeratorBadge`, `VerifiedBadge`,
`Gift1`, and `Gift25`. No downloaded JavaScript is evaluated. It validates a
narrow SVG vocabulary (paths, gradients, stops and same-image references).
Chatbus returns a normalized Badge with `svgBody`; Overlay Kit projects
that record to its existing display contract and uses the shared browser-safe
`@myrqyry/chatbus/kick-artwork` helper to validate again and render an isolated image.

Chat never waits for the lookup. The existing late-badge update path upgrades
matching semantic roles without replaying or extending the message. Native
image-backed badges win; the discovered art is used only for the exact role
or gift count and is not a basis for inferring someone's identity.

Discovery is coalesced per relay process, cached for six hours on complete
success, ten minutes on partial results and five minutes on a failed page
request. It is bounded by time, response size, total downloaded bytes and
concurrency. Known chunk filenames are hints only: the public page supplies the
current URLs. If Kick changes its frontend or denies access, the overlay
retains optional personal artwork or semantic text. No browser installation,
manual downloads, provider credentials, or per-message upstream requests
are required. This is not an official stable badge API.

The artwork is acquired at runtime and kept in memory; it is not committed or
included in a clean build. Hosted relays transmit the acquired SVG data as
part of their normalized display stream. Kick retains its rights and terms;
runtime acquisition does not establish permission for every hosted use.

## Optional personal artwork

The four previously copied Kick interface SVGs are no longer distributed in
the current source tree. If you have rights to use suitable artwork, you may
install your own PNGs. The [official Kick brand toolkit](https://about.kick.com/brand)
provides brand assets under Kick's terms; no verified official downloadable pack
of these exact role badges is known, so Overlay Kit does not scrape or invent one.
Do not assume a download grants redistribution rights.

Place any subset of these PNGs in a folder:

| Filename | Used only for |
| --- | --- |
| moderator.png | Moderator |
| verified.png | Verified |
| gift-1.png | Exactly one gifted subscription |
| gift-25.png | Exactly 25 gifted subscriptions |

Each file must be a PNG no larger than 1024 × 1024 pixels and 1 MiB. If you have
authorized SVG artwork, export it to PNG first with an image editor.

Run from the project root:

```sh
pnpm art:install "/path/to/your/png-folder"
pnpm live
```

The installer copies recognized files into the Git-ignored
`demo/local-art/kick/` directory. Rebuild or restart after replacing them.
The development/production editor and independent chat browser source load
those assets only in your own build. Missing or failed images fall back to
semantic labels. Authentic native image badges take priority. Gift counts
other than exactly one or 25 retain their own numeric text.

To return to the default, remove your PNGs from that folder and rebuild.
For public distribution, use a clean checkout without personal assets. Do not
publish a personal build unless you have rights to its included artwork.

## Boundaries

Chatbus emits semantic identity; optional art is a renderer-only configuration,
never transmitted over the relay. Native image-backed badges are not replaced
by local art. Source portrait updates and source-scoped moderation preserve roles.
Tests cover semantic projection, local art precedence, fallback on image errors,
late subscriber/portrait updates and safe badge wire shapes.
