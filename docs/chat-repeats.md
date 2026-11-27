# Repeat handling for chat overlays

Chat → Content contains optional repeat presentation. Off preserves ordinary
message delivery. Counter updates the existing row in place; Refresh also
renews the configured message lifetime; Bump renews lifetime and moves the same
row to the latest position (top/bottom/strip layout order). Enable Smooth reflow
for animated changes of position.

Controls roundtrip through presets and browser-source URLs:

- repeat=off|count|refresh|bump
- repeatMatch=exact|normalized|near
- repeatScope=sender|channel
- repeatWindow=15 (seconds of inactivity, 1–120)
- repeatCount=1 (show counter; 0 hides it)

The default is off; when enabled, exact matching, same sender, 15-second
inactivity and visible counter are defaults. Normalized and near matching apply
to plain text; non-text variants keep exact identities. Near is intentionally
conservative (one edit on 16–512 UTF-16 units, bounded candidates). No new
dependencies, background timers, or provider calls. Original normalized chat
events still reach the other consumers. This view keeps one representative row,
not a reversible archive. Existing grouped rows retain their counts when the
matching settings change, but future messages start new groups.

Collective mode retains the first sender's visual identity and labels the
number of distinct chatters. To honor moderation, deleting any constituent
message or clearing any constituent sender removes the entire representative
row. Membership metadata is removed when that row is disposed. Replies,
highlighted/intro/reward messages and cheermotes bypass compression.
No cross-source matching. Grouped rows that expire or are evicted cannot
be revived by a late repeat: a new row is created instead.
