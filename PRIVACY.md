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

## Icons and local PNG/WebP to SVG data boundary

Icons reads local PNG and WebP files and processes them with browser canvases and local
workers. Original image Blobs, exact generated SVG Blobs, filenames and paths,
nested folders, favorites, conversion state and view preferences are saved in
the separate `folio-icons` IndexedDB database on the current site/browser
profile. Results also retain their actual engine/version, native pixel-check
result, check timestamp and browser context. This metadata is local; it is not
an uploaded analytics or verification report.

Originals and queued metadata commit before conversion starts. Results survive
switching tabs, reloads and normal browser restarts in the same profile. Queued
or interrupted jobs can resume; explicitly stopped and failed jobs wait for
the user's retry. Browser storage quota and eviction rules still apply.
Removing a conversion/folder removes its local conversion copies, while original files
on disk and independently saved artwork are unaffected. Clearing site data removes the local Icons collection,
so keep original files and useful exports.

Ordinary conversion does not upload PNGs, WebPs, SVGs, filenames or decoded pixels to the
Site collection, Google Drive or a tracing service. VTracer's pinned entry
script, worker and WASM are shipped as same-origin application assets under
`/vendor/vtracer/`; ImageTracer is bundled in a local worker. Fetching those
executable assets does not send image data. No remote tracing API or CDN model
is used. Fully opaque images use VTracer with an explicitly labeled ImageTracer
fallback; eligible antialiased silhouettes use native alpha contours and cubic
fitting; other RGBA images use ImageTracer. Exact Pixel vectors and Embedded bitmap also run locally.

The existing HTML/Images Library is a separate data boundary. Its private
Site-owned collection can request metadata and resources; its Google Drive
import feature downloads the requested remote file. Local Library imports,
screenshots and preferences remain in their existing browser database. Imported
HTML runs in an isolated preview but may request external resources. Icons
does not change those features or upload its local data through them. Both
local databases share the site's browser storage quota.

Downloads are generated only when requested. A ZIP contains ready SVG results
or saved artwork in the current Icons view, up to the documented export limit. An embedded-bitmap
SVG contains the original PNG/WebP bytes, including metadata present in that file;
treat it as a copy of the source when sharing it.

Generated SVGs, embedded PNG data and ZIP downloads remain user data and must
not be committed, bundled with the app or attached as CI artifacts. Synthetic
test images are generated from code by `tests/png-fixture-generator.ts`; do
not replace them with real collection files or embedded source payloads.
Keep browser captures and generated test downloads in ignored `.qa/` or
outside the checkout. The repository's existing media exclusions and privacy
checks continue to apply to HTML, Images and Icons.

## Explicit AI actions

Opening Folio or its Settings does not contact a local CLI or AI provider. The
user explicitly pairs the browser with a companion bound to `127.0.0.1`. Every
companion data route requires the exact configured site Origin/Host and a random
per-run bearer code. The code stays in the browser tab's memory; nonsecret
provider/model/reasoning/port preferences are saved locally.

Generate sends only the selected original image (normalized locally to native-size
PNG), bounded current SVG and requested instructions through the CLI to OpenAI.
Test AI connection sends a small text request. These are explicit network
exceptions to ordinary local conversion. Credentials remain in the CLI's own
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
current SVG Blobs in `folio-icons`; changing color preserves the immutable base.
Deleting a source conversion does not cascade into these saved records. Explicitly
deleting a saved icon removes its own snapshots. Saved icons are browser-local,
not cloud-synchronized; storage clearing/eviction remains possible.

The private Site's sign-in/out and identity headers are supplied by its hosting
platform. The account endpoint is private and uncached. A local display name does
not grant access or alter the provider identity. Password management remains with
ChatGPT; Folio does not collect passwords. The app's account and the local Codex
account are separate and neither is proof that an AI request succeeded.
