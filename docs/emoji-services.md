# Unicode emoji services

Unicode emoji are ordinary text grapheme clusters; they are not Twitch, Kick, BTTV, FFZ, or 7TV emotes. Overlay Kit handles them only in the presentation layer. Chatbus normalization and emote catalogs remain unchanged.

## Chat

In **Chat → Artwork → Emoji artwork service** choose:

- **System emoji (native)** (default): leave Unicode text untouched. On macOS/iOS, native rendering can show Apple's emoji artwork. On Linux/OBS it uses the installed system emoji font, not Apple's.
- **Google Noto Color Emoji**: inline SVG artwork from Google's open-source Noto Emoji repository, pinned to commit `99701e07d3d1fe1bdbcdb14964547f0fd592966f`. Noto's source SVG directory doesn't contain national flag pairs, so those remain native text.
- **Twemoji**: inline SVG artwork loaded from pinned Twemoji 17.0.3 assets on jsDelivr.
- **OpenMoji**: inline SVG artwork loaded from pinned OpenMoji 17.0.0 assets on jsDelivr.

Only recognized Unicode emoji graphemes are substituted. Combined emoji sequences (ZWJ, skin tones), flags, and keycaps remain intact. The text is never parsed as HTML. Only fixed CDN paths constructed from Unicode scalars are requested. A missing asset reverts to its original Unicode text; at most 120 images are created per text fragment.

In browser-source links: `chat.html?emoji=noto`, `chat.html?emoji=twemoji`, or `chat.html?emoji=openmoji`.

## Emote Wall

In **Emote Wall → Artwork → Unicode emoji on wall** choose **Off** (default), **System emoji**, **Google Noto Color Emoji**, **Twemoji**, or **OpenMoji**. Once enabled, emoji within text/mention fragments become additional wall artwork with the same size, motion, moderation, lifetime, and capacity behavior as provider emotes. There is a limit of 24 extra Unicode emoji per chat message. Existing Chatbus emote stacks and modifier behavior remain independent.

In browser-source links: `wall.html?wallEmoji=noto` (or `system` / `twemoji` / `openmoji`).

The two view settings and their presets are independent. The Studio preview uses synthetic example messages; normal OBS pages still only display real traffic.

## Dependencies, attribution and limitations

Hosted SVG services need network access; System emoji work offline. No remote JavaScript or HTML is loaded. Missing artwork falls back to native text. Browsers without `Intl.Segmenter` retain native emoji text instead of splitting complex sequences. Only emoji recognized by the running browser's Unicode grapheme properties can be replaced.

- **Google Noto Color Emoji** by Google / contributors, source SVG assets licensed Apache 2.0. Source: https://github.com/googlefonts/noto-emoji (license at `2D/svg/LICENSE`).
- **Twemoji** by Twitter / contributors, artwork licensed CC BY 4.0. Source: https://github.com/jdecked/twemoji
- **OpenMoji** by HfG Schwäbisch Gmünd / contributors, artwork licensed CC BY-SA 4.0. Source: https://openmoji.org and https://github.com/hfg-gmuend/openmoji

These are external artwork services, not bundled emoji fonts or offline asset packs. Respect the applicable license terms (including attribution/share-alike where required). Apple's proprietary Color Emoji artwork is **not** a remote image provider: System emoji can use Apple's native font when running on an Apple device, but Overlay Kit neither bundles nor downloads Apple's font or images. Chrome rendering can be checked locally, but actual OBS CEF needs separate verification.
