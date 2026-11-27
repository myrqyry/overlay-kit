# Twitch Tier 2/3 subscriber GIFs

**Supported in Chat, optional in Emote Wall.** This is Twitch's GIPHY subscriber GIF feature, separate from animated Twitch emotes.

Twitch IRC supplies a gifs tag containing inclusive positions, a GIF ID and the complete GIF asset URL. The pinned Chatbus runtime preserves those records as normalized media fragments alongside ordinary text and emotes. The source-owned message identity, badges, source scope, moderation and viewer metadata remain unchanged. Authenticated EventSub already supports GIF fragments; the anonymous IRC path is now supported too.

Chat uses its existing constrained media image renderer (up to 240px wide and 160px high). A pasted link without official GIF metadata remains a link/text, not auto-embedded media. The same-origin preview bridge now validates media and mention fragments without accepting executable image URLs.

To opt into floating GIFs, use **Emote Wall → Artwork → Twitch subscriber GIFs**, or the Wall OBS URL parameter wallGifs=1. This starts **off**. Only normalized Twitch GIPHY GIF media can enter the wall, at most four GIFs per chat message. They retain wall capacity, lifetime, motion, source isolation and moderation cleanup. Images keep their aspect ratio and have a display width capped at 240px (and three times the selected wall emote height). Disabling the switch affects future arrivals, not existing items.

Twitch requires that applications display its GIF with the **exact URL provided**, including query data. Malformed or overlapping ranges and unsafe external hosts are rejected. Ordinary network availability still determines whether media loads.

**Verification:** Source-level tests for multi-GIF handling, text/emote order, URLs, bad tags and ACTION offsets; Bridge, Chat DOM, Wall settings/behavior tests. Chromium at 960×540 loaded Twitch's documented GIF (intrinsic width 480px) in Chat (160px render) and the opt-in Wall (48px render), preserved the original URL, and displayed nothing on the Wall with GIFs disabled. No browser runtime exceptions. A genuine live Tier 2/3 subscriber post and native OBS CEF remain untested.

Twitch documentation: https://dev.twitch.tv/docs/chat/irc/ and https://dev.twitch.tv/docs/eventsub/reference/chat.
