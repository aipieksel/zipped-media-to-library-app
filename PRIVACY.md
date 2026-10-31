# Repository content policy

This repository contains application code and text development documentation.
Imported ZIPs, original HTML, images, image renditions, screenshots, captures,
collection catalogues, resource manifests and source-history bundles must stay
outside Git. Store collection data in private browser/Site storage.

The only media exceptions are the app's root `index.html` entrypoint and small
`public/favicon.svg` icon. Test data is generated in code; real collection
fixtures must not be checked in. Do not put originals or collection data in
`public/`, JavaScript strings, JSON, base64, release assets or CI artifacts.

`.gitignore` excludes common payloads. `npm run check:privacy` scans the Git
index, including force-added files, for disallowed paths and binary/document
payloads. It also runs before tests/builds and in GitHub Actions. CI detects
violations after upload; it cannot prevent a public push or undo an exposure.

Enable the local pre-commit check in every checkout:

```sh
git config core.hooksPath .githooks
```

Run the check before every commit or source transfer. A local hook can be
bypassed, and no automated check proves the absence of embedded private data;
review staged changes as well. Removing a tracked file affects the current tree
only. Old commits, clones and cached copies require separate history/cache
remediation. Repository visibility is independent of the private live Site's
access policy.

## Local processing and the shared workspace

PNG/WebP decoding, vectorization and native pixel comparison run in browser canvases
and local workers. No tracing service or remote model is used for ordinary
conversion. VTracer code/WASM and ImageTracer are shipped as application assets.

The account/shared-data amendment changes storage ownership: after Folio login,
new Library and Icons imports, folders, favorites, screenshots, completed SVGs and
chosen artwork are stored in the same private server workspace for every active
member. D1 holds bounded metadata, memberships, credentials and sessions. R2 holds
immutable SHA-256-addressed chunks under a separate shared prefix. Uploads must be
complete before metadata publication; conflicts do not silently overwrite another
member's changes. Metadata includes names, paths and recorded fidelity provenance.
A saved pixel check remains historical browser-specific evidence.

The browser maintains a separate shared cache. Selection, scroll/expansion,
conversion worker leases and AI pairing are device-local. Existing `folio-workspace`
and `folio-icons` browser-only data is preserved. Settings → Workspace provides an
explicit inventory and transfer action; signing in alone does not upload those
old files. Migration retains original local data and stable identities for retry.
The previously curated R2 collection is reused without copying its original bytes.

All members see one dataset. Removing or hiding a shared import, moving files,
starring folders, recoloring saved artwork or changing appearance affects the
workspace. Deleting a conversion does not delete independent saved artwork.
Browser-cache clearing does not delete server-saved files; pending local work and
old unmigrated files can still be lost to browser eviction. Keep originals/backups.

Private APIs require active Folio membership; protected GET/HEAD/conditional media
responses use private/no-store. Logout revokes the app session and unmounts private
views. It cannot erase files a person previously downloaded. Existing administrator
ingestion has its own separate credential and cannot use an ordinary member cookie.
Imported HTML remains isolated in a preview but may request its own external assets.
Google Drive imports download only the requested remote file before shared saving.

Downloads occur on request. Embedded-bitmap SVG contains original PNG/WebP bytes,
including source metadata; treat it as a copy when sharing. Original data, SVGs,
ZIPs, captures and operational inventories never belong in GitHub or build/CI artifacts.
Procedural media fixtures are generated from source code in ignored `.qa/`;
development harness HTML also includes ignored `tests/shared-client-*.html` files.
Do not replace these fixtures with real media. The repository privacy gate remains required.

## Explicit AI actions

Opening Folio or its Settings does not contact a local CLI or AI provider. The
user explicitly pairs the browser with a companion bound to `127.0.0.1`. Every
companion data route requires the exact configured site Origin/Host and a random
per-run bearer code. The code stays in the browser tab's memory; nonsecret
provider/model/reasoning/port preferences are saved locally.

Generate sends the selected original image (normalized locally to native-size
PNG), its sanitized source filename, bounded current SVG and requested instructions
through the CLI to OpenAI. Image preparation includes the basename, not the full
filesystem path.
Test AI connection sends a small text request. These are explicit AI-provider requests, separate from shared workspace storage. Credentials remain in the CLI's own
account store; they are not sent to Folio's Site backend, kept in app storage,
included in output errors or committed to Git. API-key authentication is rejected.
An account's provider usage and processing terms still apply to the chosen request.

The companion has fixed SVG/test operations, bounded payload/output/time limits,
one active request, cancellation, a restricted temporary job directory and
pre-inference configuration checks. It does not expose arbitrary command, path,
argument or working-directory selection to the browser. Temporary source/prompt/
answer files are removed after the child process terminates. Configurations that
require incompatible tool access are rejected rather than silently weakened.

Candidates are displayed as Blob-backed images after strict XML geometry
validation. User-approved saved artwork contains independent original, base and
current SVG Blobs in the shared workspace; changing color preserves the immutable base.
Deleting a source conversion does not cascade into these saved records. Explicitly
deleting a saved icon removes its active artwork and snapshot references from the
shared workspace. This version does not delete immutable server chunks when an
item is removed, so removing an entry does not guarantee erasure of previously
uploaded bytes. Previously downloaded copies also remain outside app control.
Saved icons are shared after server acknowledgement; existing unmigrated
browser-only artwork remains local until explicitly transferred.

## Folio accounts and hosting access

Folio email/password accounts are separate from both the private hosting gate and
AI provider login. Passwords are sent only over the app's same-origin account
endpoint and stored as salted slow hashes, never in browser storage or source.
Opaque server sessions use HttpOnly/SameSite cookies and Secure on HTTPS. Exact
Origin checks, bounded requests and persistent rate limits protect mutations.
User details and credentials are not placed in public GitHub or browser logs.

Bootstrap and owner recovery require the configured trusted Site-owner identity.
Owners can create expiring, recipient-bound, single-use invitation/recovery links;
only hashes are retained server-side. Link capabilities are transient fragment
values and are removed from the current history entry after successful use. No
invitation/reset email is sent automatically. An app invitation does not widen the
Site's access policy. A teammate still needs permitted hosting access.

The existing private Site gate and its authentication endpoints are preserved.
App account setup cannot be simulated by a local preference or an AI pairing code.
The account settings UI does not claim an AI request succeeded merely because the
app is signed in. The production owner chooses their own password; test accounts
and the development-only QA backend contain only procedural fixture data.
