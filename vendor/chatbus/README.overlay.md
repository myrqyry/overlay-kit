# Pinned Chatbus runtime snapshot

Overlay Kit's Vercel/Vite build must not depend on a sibling checkout or
private registry token. This directory contains tracked src/, package.json, LICENSE and NOTICE
from the commit in UPSTREAM_COMMIT in the public myrqyry/chatbus repository,
without copying the sibling working tree, tests, caches or credentials.

To update it, review the upstream changes, ensure the upstream checkout is
clean, then repeat the documented git archive HEAD src package.json LICENSE NOTICE operation
and update UPSTREAM_COMMIT, followed by pnpm install, tests, typecheck, build,
and review of the resulting diff. This is a deployable snapshot, not an
automatically synced fork.

The snapshot includes shared Kick role-artwork discovery and the browser-safe
./kick-artwork export. Overlay Kit does not maintain a duplicate provider
lookup or sanitizer. The snapshot is pinned to a published Chatbus commit.

The LICENSE and NOTICE are copied unmodified from Chatbus upstream, which
now uses Elastic License 2.0. The archived source and manifest are also
unmodified. See https://github.com/myrqyry/chatbus for the upstream project.
