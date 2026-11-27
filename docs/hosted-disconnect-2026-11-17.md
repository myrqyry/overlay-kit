# Hosted editor disconnect — 2026-11-17

Root cause: hosted studio removal of the last selected source passed an
empty array to withViewerSources, which stripped all room parameters.
Each preview then used the hosted capability's default room. Restoring
an explicit empty stored array also reselected that default. The editor
could appear disconnected while its four preview clients remained
subscribed, and reload reconnected the editor as well.

The empty selection now emits live=0, stored arrays (including []) are
authoritative, and studio preview URLs stay live-disabled during capability
discovery. The editor status subscription uses an actually selected room.
First-visit defaults, intentional reconnect, independent OBS subscriptions
and the existing local hub/Chatbus implementation are retained.

Validation: the actual production-built editor in Chromium, fresh browser
storage, with controlled hosted capability and WebSocket boundary fixtures
(no live provider or production host), reproduced five sockets before
removal, four remaining after removal, and five after reload. After the
fix: five initially, zero after removal and reload, a deliberate reconnect
opened five, and the second removal closed all five. No page exceptions.
Separate existing real loopback HTTP/WebSocket tests verify upstream close
when the last hosted listener leaves and local removal calls provider close.
Two new deterministic source-selection regressions cover no-live URL
generation and explicit empty persistence. The browser test does not
establish a deployed Vercel or live provider disconnect receipt.

No changes to Chatbus, hosted server protocol, credentials or other
applications. Independent OBS sources must be closed separately if their
previously generated URLs still select a room. Local status WebSocket
remaining open is intentional and does not keep an explicitly removed
provider source connected.
