# Distribution and release readiness

Review date: 2026-11-26. This is an engineering and provenance review,
not legal clearance or authorization to make a repository public.

**Source-release licensing disposition:** all identified dependency-code
redistribution gaps have been addressed through source-only distribution
and preserved notices. This is the reviewed distribution method, not a
claim that every possible downstream deployment or redistribution is licensed.

## License scope

- Overlay Kit and the pinned Chatbus source snapshot both use the
  unmodified Elastic License 2.0. Chatbus upstream source, package manifest,
  LICENSE and NOTICE are verified byte-for-byte against the public commit
  `959c9e137f51c0f23d779cacdb1af74b2272ecaf`. The upstream repository is
  https://github.com/myrqyry/chatbus.
- The installed production dependency inventory covers 70 package versions.
  Most are MIT, Apache-2.0, BSD or other permissive terms. The complete known
  license and copyright texts and the exact version identifiers are in
  [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt).
- GSAP 3.15.0 is under the [standard no-charge license](https://gsap.com/standard-license/),
  not an OSI license. Its FAQ explicitly distinguishes niche visual tools
  from animation builders competing with Webflow. Overlay Kit is a streaming
  chat/emote effects editor rather than a general website animation builder,
  so retaining GSAP appears consistent with that distinction. This is a
  project-level interpretation, not written permission from Webflow.
  If the intended scope changes toward general visual animation authoring,
  obtain clarification or replace GSAP; downloading it separately would
  not change those terms. The build retains both original GSAP/CSSPlugin
  copyright headers and the notice links.
- Five production packages omit complete standalone license text from their
  installed package root. Buf and tiktok-live-proto notices are recovered
  from their exact sources. agent-base 6.0.2, https-proxy-agent 5.0.1 and
  tiktok-live-api-sdk 0.4.0-beta1 declare MIT in their published manifests.
  Their known upstream notices are included for users who install them.
  **Resolution for source distribution:** the generated hosted entrypoints
  contain only Overlay Kit and its licensed first-party Chatbus snapshot.
  All third-party npm packages are installed directly from the original
  package registry with the frozen lockfile; none of their implementation
  code is included in the source archive. The build enforces that boundary
  through esbuild's input and external-import metadata. Exact historical
  notice-file recovery is therefore not a source-release prerequisite.
  The fallback provenance remains recorded in
  [the manifest](../licenses/upstream/sources.json) for transparency.
- Kick role SVGs are fetched at runtime by Chatbus and are absent from the
  clean source/build; native remote provider art and optional personal
  artwork retain their own rights. The service-identifying pictograms,
  platform names and screenshots are not a grant of platform trademark or
  asset rights. Runtime fetching is undocumented and not proof of permission
  for hosted redistribution. Review applicable platform terms if hosting.

Run `pnpm licenses:generate` after an intentional dependency update and
review the diff; `pnpm licenses:check` regenerates the expected inventory
in memory and fails if either tracked copy differs. Production builds run
this check before compiling. The built editor serves the project LICENSE,
NOTICE and third-party notices without watermarking the overlay output.
Development-only dependencies are not redistributed by the runtime build.

## Public source boundary

The public repository starts from a reviewed source snapshot, with no
development Git history, local optional artwork, credentials or internal
project records. The development repository and its history are maintained
separately. Source snapshots are scanned for secrets, reviewed for the
allowlisted payload and built from a fresh frozen dependency install.

## Source-only release candidate

From a clean committed checkout:

```sh
pnpm install --frozen-lockfile
pnpm licenses:check
pnpm test
pnpm build
pnpm release:source /absolute/path/overlay-kit-source.zip
```

The exporter uses an explicit Git-tracked path allowlist at HEAD, rejects
known sensitive paths and copied legacy role SVGs, and refuses a dirty
working tree or overwriting an archive. It excludes .git, .meristem,
ignored configuration, dependencies, build output and local artwork.
The result contains the source, lockfile, notices, approved docs and
reproducible first-party hosted JS entrypoints; npm implementation code
is external and installed normally with pnpm. Verify an extracted candidate with a current
secret scanner and a fresh frozen install/build before publishing. A scan
is not permission to publish. Native OBS CEF and actual hosted production
verification are tracked separately.
