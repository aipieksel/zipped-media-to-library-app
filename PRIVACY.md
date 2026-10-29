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

## Icons and PNG to SVG data boundary

Icons reads local PNG files and processes them with browser canvases and local
workers. Original PNG Blobs, exact generated SVG Blobs, filenames and paths,
nested folders, favorites, conversion state and view preferences are saved in
the separate `folio-icons` IndexedDB database on the current site/browser
profile. Results also retain their actual engine/version, native pixel-check
result, check timestamp and browser context. This metadata is local; it is not
an uploaded analytics or verification report.

Originals and queued metadata commit before conversion starts. Results survive
switching tabs, reloads and normal browser restarts in the same profile. Queued
or interrupted jobs can resume; explicitly stopped and failed jobs wait for
the user's retry. Browser storage quota and eviction rules still apply.
Removing an icon/folder removes its local saved copies, while original files
on disk are unaffected. Clearing site data removes the local Icons collection,
so keep original files and useful exports.

The converter does not upload PNGs, SVGs, filenames or decoded pixels to the
Site collection, Google Drive or a tracing service. VTracer's pinned entry
script, worker and WASM are shipped as same-origin application assets under
`/vendor/vtracer/`; ImageTracer is bundled in a local worker. Fetching those
executable assets does not send image data. No remote tracing API or CDN model
is used. Fully opaque images use VTracer with an explicitly labeled ImageTracer
fallback; detected antialiased silhouettes and other RGBA images use
ImageTracer. Exact Pixel vectors and Embedded PNG also run locally.

The existing HTML/Images Library is a separate data boundary. Its private
Site-owned collection can request metadata and resources; its Google Drive
import feature downloads the requested remote file. Local Library imports,
screenshots and preferences remain in their existing browser database. Imported
HTML runs in an isolated preview but may request external resources. Icons
does not change those features or upload its local data through them. Both
local databases share the site's browser storage quota.

Downloads are generated only when requested. A ZIP contains ready SVG results
in the current Icons view, up to the documented export limit. An embedded-PNG
SVG contains the original PNG bytes, including metadata present in that file;
treat it as a copy of the source when sharing it.

Generated SVGs, embedded PNG data and ZIP downloads remain user data and must
not be committed, bundled with the app or attached as CI artifacts. Synthetic
test images are generated from code by `tests/png-fixture-generator.ts`; do
not replace them with real collection files or embedded source payloads.
Keep browser captures and generated test downloads in ignored `.qa/` or
outside the checkout. The repository's existing media exclusions and privacy
checks continue to apply to HTML, Images and Icons.
