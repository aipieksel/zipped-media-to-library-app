# Folio · HTML, images and icons

**Repository privacy:** this repository is for application source. Keep imported
ZIPs, HTML, images and captures in private app storage. See [PRIVACY.md](PRIVACY.md)
for exclusions and the local pre-commit check.

A compact browser workspace for exported HTML pages, images and PNG/WebP-to-SVG icons. Folio accounts share one private workspace: new imports, folders, favorites, screenshots, original icons and saved artwork use authenticated server storage. Conversion still runs locally. Existing browser-only files are preserved and can be deliberately shared from Settings. Collection bytes and operational inventories are never bundled in this repository.

Use the custom **workspace dropdown above Search** to choose **HTML**, **Images** or **Icons**. All three use the same file sidebar, tree, search, sorting, Favorites and previous/next navigation. Icons extends that workspace with conversion controls in the canvas toolbar; it has no separate converter sidebar. HTML and Images retain the existing Library tools and collection.

## Using the workspace

1. In **HTML** or **Images**, drop ZIPs or images anywhere in the workspace, use the sidebar's **+** button, or use the Google Drive button to paste a share link for one downloadable ZIP/image. Drive folder links are not supported, and private files must be changed to “Anyone with the link” with downloads allowed. The one-line hint at the bottom of the sidebar is also an import button. In **Icons**, the same import controls accept local PNGs, WebPs and folders; see [local PNG and WebP to SVG conversion](#local-png-and-webp-to-svg-conversion).
2. Select **HTML** or **Images**. Archive names and folders form the tree; HTML's supporting assets remain available without appearing in the HTML tree. An `index.html` or `index.htm` page uses its containing folder or archive name.
3. Use **Previous / Next** or **↑ / ↓** to cycle through all matching files in the current tab, including files beneath collapsed branches. Navigation wraps at either end. Search and Favorites narrow the same order used by the tree and gallery.
4. Star a file or an entire folder. Click a folder's name to open its first matching file; use the separate arrow to expand or collapse it. Create folders or use **Move to folder** to organize HTML and images together. Choose **Original archive** in their move picker to return an item to its original tree position. Icons uses its own nested folders in the same tree interface; **Uncategorized** is its permanent destination for loose icon files.
5. In HTML and Images, open **View and capture settings**, immediately before Gallery, for preview width, fit, screenshot mode and capture controls. Icons keeps mode, zoom, transparency background, queue controls and ZIP export in its canvas toolbar. The main workspace has no large permanent drop area.

The sidebar occupies the full desktop height. Drag its separator to resize it, or focus the separator and use arrow keys, Home or End. Double-click resets its width. On a narrow screen, the file-sidebar button opens it as a drawer.

Sort alphabetically, newest/oldest, or by original image pixel area. Group by folders or month. Dates use available file metadata with labeled source/archive/import fallbacks. Image filters include landscape, portrait, square and unknown dimensions.

Both HTML and Images have canvas galleries. Choose Auto or 1–8 columns and rows, then page through the matching results. Image cards use small renditions when available. HTML cards show a saved capture first, or prepare an automatic thumbnail as that gallery page is browsed. Automatic thumbnails use a bounded, disposable browser cache.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| ↑ / ↓ | Previous / next matching file in the active tab, with wrap-around |
| Home / End | First / last matching file |
| ← / → in the tree | Collapse or expand a branch; move focus to a parent or first child |
| Enter / Space in the tree | Open the focused file or the folder's first matching descendant |
| `/` | Focus file search |
| Escape | Dismiss a dialog or popover; return focus from an HTML preview to the tree |

Shared file navigation works in all three tabs. Shortcuts do not take over arrow keys while editing a text input. The shared custom dropdown supports keyboard navigation, typeahead, selection and Escape; file shortcuts yield while it is active. Within live HTML, the preview bridge relays navigation keys when the page is not editing a field.

## Images, screenshots and downloads

The Images tab supports **PNG, JPEG, GIF, WebP, AVIF, SVG, BMP and ICO**. Image files inside HTML archives also become available there. The image viewer offers fit and actual-size presentation, dimensions, and a thumbnail gallery. SVG files are displayed through an image element, not inserted into the workspace's document as executable markup.

For HTML, **View and capture settings → Capture current page** saves a PNG for the selected page. **Capture pages…** runs a serial background queue over the current search or Favorites results. Choose width, loading delay, full-page capture and whether to replace existing screenshots. You can continue browsing and cancel the queue; completed captures stay saved. A camera badge marks captured HTML pages. The screenshot gallery's **Open HTML** action returns to the exact source item.

The image download contains the original image bytes. The primary HTML download builds a ZIP containing the selected page's owning archive and retained resources, with original paths intact. The download button prepares the file and starts the browser download in one action. **Download HTML source only** is a separate **View and capture settings** action for cases where linked files are not needed. Moving a page into a user folder does not change its download or break its relative assets.

Captures use an in-browser DOM renderer, not a remote Playwright service. Keep the tab open. External assets need network access and may be blocked by their source. Video, embedded frames, canvas effects, computed or scoped module loading, and some CSS can render or capture differently. Full-page capture stops at 12,000 pixels in height. The application shows resource or capture notices rather than claiming every export is fully compatible.

## Local PNG and WebP to SVG conversion

Open **Icons** and drop PNGs, WebPs or folders onto the canvas or sidebar, use the sidebar's **+** or folder-import button, or choose **Import PNGs / WebPs** or **Import folder** in the empty state. Original PNG or WebP bytes and queued entries are saved before conversion starts automatically; in the authenticated app, the shared save is acknowledged first. Loose files enter the persistent **Uncategorized** folder. Folder imports retain their hierarchy, including distinct roots with the same name; safe suffixes resolve display and export-name collisions.

Directory drops preserve empty folders when the browser exposes directory entries. A file-only folder chooser can preserve the paths of files it returns, but cannot report empty folders. Unsupported files, unreadable entries and admission limits produce import notices rather than silently merging unrelated folders. The [import implementation](src/icon-drop.ts) defines the supported directory-entry and picker paths.

Select an icon in the shared tree to compare the saved original and generated SVG. The previews use a common scale and synchronized scrolling. Choose **Fit**, **100% · native**, **200%** or **400%**, and checkerboard, light or dark transparency backgrounds. **Show source pixels** enables nearest-neighbor inspection of the original bitmap; it does not change the SVG or the native fidelity check.

The mode selector applies to the selected icon immediately and becomes the saved default for new imports. Existing icons retain their own mode until reconverted. **Stop this icon** cancels one job; **Stop (n)** cancels pending work without removing completed results. Stopped or failed entries retain their original image for **Convert again**. In the authenticated app, removing an icon or folder removes its conversion entries and original-image references from the shared workspace for every member after confirmation. Independently saved artwork, original files on disk and preserved browser-only copies remain intact.

- **Pixel vectors · exact grid** is the default. Browser-decoded RGBA pixels become editable SVG rectangles. Adjacent pixels with identical color and opacity merge into non-overlapping shapes. Dimensions, transparency and antialiased edge opacity are retained without tracing, resizing or color quantization. These shapes preserve the pixel grid and still look pixelated when enlarged.
- **Smooth curves · approximate** fits editable paths to the decoded image. Shapes, colors, edge coverage or small details may change. The result shows the actual tracing engine and native differing-pixel count; it does not promise exact recovery of an original drawing. Smooth mode has a smaller workload budget and never silently reduces the source dimensions.
- **Embedded bitmap · original bytes** places the original PNG or WebP bytes inside an SVG image element. It is a bitmap inside an SVG, not editable vector artwork. Choose it when pixel geometry is impractically large or original source bytes matter. Conversion never silently changes between these three modes, and file/output limits still apply.

**Download SVG** saves the selected result. **Download ZIP (n)** exports ready icons in the current search/Favorites view; its count excludes unfinished, cancelled and failed entries. Filter the collection to make a smaller export when needed. Output names preserve source basenames where safe, with suffixes for case-insensitive and Unicode-equivalent collisions. Originals and generated results remain saved after a download.

### How smooth tracing is selected

All tracing runs locally. The [browser adapter](src/png-svg-browser.ts) and [trace profiles](src/png-svg-trace.ts) use these routes:

| Decoded source | Selected local engine |
| --- | --- |
| Fully opaque image | VTracer through pinned `vtracer-browser` 0.0.3; if it cannot complete, an explicit warning identifies the ImageTracer result used instead |
| One opaque foreground color with a narrow antialiased fringe and transparent background | Native alpha contours: marching squares at fractional-pixel positions, followed by fit-curve 0.2.0 cubic fitting; the foreground color is restored |
| Other transparency, translucent interiors, soft alpha fields, multicolor transparency or a fully transparent image | ImageTracer 1.2.6 with a deterministic RGBA palette |

The conservative silhouette detector requires an opaque foreground and transparent background. It accepts a narrow resampled antialias fringe only when each partial-alpha pixel has a monotone route to both opaque color and transparency within three eight-neighbor steps. It rejects the tested translucent interiors, disconnected translucent islands, broad alpha gradients and distinct foreground colors. This is a bounded inference about edge coverage, not proof of the original drawing intent. General RGBA results explain the actual eligibility guard that declined the silhouette route. The eligible silhouette route interpolates the source alpha field at 127.5 and fits cubic Bézier curves to its closed contours. It retains every extracted loop, including holes, with evenodd fill. The configured fit tolerance is 0.25 native pixels at the contour samples; it is not a universal geometric-error guarantee. Pixel vectors and general RGBA tracing do not use this contour threshold. VTracer's RGB-only output is used only for fully opaque source pixels. ImageTracer uses no added strokes, blur or small-path omission; its palette is bounded, so complex images may still lose color detail.

Two fixed **procedural** 96 × 96 shapes are measured against independently sampled 4× analytic targets. In the recorded Chrome 155 run, the current cubic method reduced mean absolute alpha error by **76.2%** on the original hole/island/stroke fixture and **85.5%** on the resampled two-ring fixture compared with enlarged pixel geometry. The latter's four circular boundaries all have 100% genuinely curved angular coverage and no flat runs, while retaining four components, two holes and the tested stroke/island details. The actual output was also inspected at 400%. Earlier VTracer silhouette and binary-mask ImageTracer candidates are retained in the evidence as rejected trials. These measurements concern these synthetic inputs and this browser, not a promise for arbitrary artwork. Native differences remain visible: 397 and 1,289 respectively out of 9,216 pixels. See [current curve verification](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/artifacts/revision-7-verification.md).

### WebP support

Static lossy (`VP8`), lossless (`VP8L`) and extended (`VP8X`) WebP files use the same imports, folders, automatic queue, modes and exports. File signatures determine decoding and embedded MIME types. Names/MIME hints alone cannot make invalid bytes a supported image. Container and dimension checks precede browser decoding; a corrupt compressed stream can still fail during decoding and receives a recoverable error. Animated PNG and WebP are explicitly unsupported by this static converter; export a still frame first.

Lossy WebP fidelity is measured against this browser's decoded WebP pixels, not the unknown image before compression. Embedded mode retains the original file bytes, including metadata, under the correct `image/png` or `image/webp` data URL. Existing saved PNG records remain readable without resetting or migrating the Library. Mixed source names such as `mark.png` and `mark.webp` receive distinct `.svg` download names.

### What “Pixel match verified” means

Each generated SVG is rendered at the source image's native dimensions and compared with the decoded source on a transparent **8-bit RGBA sRGB canvas in the current browser**. The check uses the actual downloadable SVG, independent of preview zoom, background or device-pixel ratio. A pixel differs if alpha changes, or if any RGB channel changes while either alpha is nonzero. RGB is ignored only when both alphas are zero; there is no tolerance.

**Pixel match verified** appears only for zero differing pixels. Other results show the differing-pixel count or **Pixel check unavailable** with an explanation. A generated SVG remains available when verification cannot complete. Smooth output follows the same strict rule; approximate curves do not receive a tolerance-based exactness badge.

Each result saves the check timestamp, browser, engine/version and native **sRGB RGBA8** context alongside the exact SVG. A **Saved native-size check** is historical evidence, not proof for every browser. Shared artwork is validated before preview or export, and another account/device's claimed pixel-match status is not trusted: opening it performs a fresh check in this browser against the exact shared source/output bytes. Use **Convert again** for a new conversion. PNG/WebP color metadata and 16-bit PNG sources receive scope warnings: the check uses the browser's 8-bit sRGB reference, while embedded mode retains the original file bytes. This does not certify every browser, color profile or original 16-bit channel value. Smooth, editable curves cannot generally be recovered exactly from arbitrary raster images.

### Converter storage and limits

Original PNG/WebP files, completed SVGs, nested folders and favorites are shared through authenticated D1 metadata and immutable R2 chunks. The browser keeps a separate shared cache; existing **`folio-icons`** records are preserved for deliberate migration. Worker claims, view preferences and AI pairing remain device-local. Startup reads metadata and source/output bytes load as needed.

The importing browser resumes queued work automatically while the app is open. Another device can see the pending originals and take over with **Convert again**. Interrupted processing can resume after its prior claim expires; a second tab does not take over a live job. Explicitly stopped and failed jobs stay stopped until **Convert again**. Claims and revision checks prevent an old conversion from restoring a deleted or superseded result. Storage or quota failures are shown instead of reporting an unsaved result as ready. See the [collection storage](src/icon-collection.ts) and [queue controller](src/useIconCollection.ts).

| Boundary | Limit |
| --- | --- |
| Source PNG or WebP | 20 MiB per file |
| Native dimensions | 4096 px per side and 4,194,304 total pixels |
| Pixel vector complexity | 150,000 merged rectangles |
| Smooth input | 1024 px per side and 262,144 total pixels |
| Smooth output complexity | 20,000 paths and 200,000 path commands |
| ImageTracer palette | Up to 64 RGBA colors |
| Smooth worker operation | 45 seconds per engine attempt, with cancellation |
| Individual SVG | 24 MiB |
| One import | 100 supported images and 100 MiB of accepted source bytes |
| Folder traversal | 5,000 entries, including folders/unsupported files, and 32 path levels |
| One ZIP export | 128 MiB of generated SVG input bytes |

Static PNGs and WebPs are supported; animated PNGs and animated WebPs are rejected explicitly. Invalid, oversized or excessively complex files produce actionable errors without silent downscaling. The 100-file limit applies to each import, not the saved collection's lifetime. Shared saves are bounded by the metadata and chunk limits below. Browser quota still applies to caches, pending work and preserved old local files. Keep your originals and useful exports; shared storage is persistence, not a backup policy.

## AI SVG studio and Saved icons

Use **Save to library** on a ready conversion, or **Recreate with AI** on that same
page. The **Convert / Saved** switch stays in the canvas toolbar; both views use
the existing Icons sidebar, folders, search, favorites and file navigation.
The selected image in **Images** also has an **AI SVG** action using the same AI
settings and candidate review panel.

AI can recreate a source image as clean SVG geometry or clean up its current SVG.
The prompt preserves the design, native canvas, proportions, negative space,
colors and transparency, with optional instructions for the requested changes.
It asks for self-contained editable shapes and curves. Folio validates the XML,
rejects active/external/embedded-image content, then renders the exact accepted
SVG at native size against the original image. The result is a separate candidate;
review it and choose **Save to icon library** or **Download candidate**. Cancellation,
navigation and a newer source revision cannot replace the existing conversion.
AI reconstruction is an approximation, not a guarantee of pixel-perfect curves.

### Connect your ChatGPT account

Open the sidebar **Settings cog → AI**. The browser connects explicitly
to the Folio companion running on your own computer. The companion uses the
official Codex CLI's ChatGPT sign-in; it does not substitute API-key billing.
The supplied package is adapted in [vendor/ai-cli-integration](vendor/ai-cli-integration).
Provider credentials stay with the CLI. The companion's pairing code stays in
this app tab's memory and expires when the companion is restarted.

One-time setup, with Node.js 22 or newer:

```sh
npm install -g @openai/codex@0.166.0
codex login
git clone https://github.com/aipieksel/zipped-media-to-library-app.git
cd zipped-media-to-library-app
npm ci
npm run companion:build
npm run companion
```

Keep the terminal open, copy its pairing code into AI settings, and connect.
Allow the browser's local-computer connection permission if prompted. Choose a
model and reasoning level from the actual CLI catalog. **Test AI connection** runs
a small real text request; generating an icon tests the separate image-to-SVG
path. See [companion setup and troubleshooting](companion/README.md).

Codex 0.166.0 is the release used for the real, unauthenticated flag and strict
configuration compatibility probe. That probe is not a successful provider
request or a test of the owner's account. Automated process/HTTP tests use
deterministic CLI fixtures. A real account/image inference still requires the
owner's local sign-in, companion and explicit generation action.

OpenAI/Codex is the enabled SVG adapter. The supplied package includes Grok
discovery, but its image execution and restrictions have not been verified, so
Grok SVG generation stays unavailable. DeepSeek is not implemented in that
package. The shared service has provider/capability contracts for future tools;
general photo editing and bitmap generation are not claimed by the current SVG
adapter. Ordinary PNG/WebP conversion does not need an AI-provider connection. The hosted shared workspace requires a Folio account.

AI accepts static PNG, WebP and JPEG originals up to 8 MiB, 4096 pixels per side
and 4,194,304 pixels. It prepares a native-size PNG attachment without silently
resizing. That normalized PNG must also fit 8 MiB, so a compressed JPEG or WebP
within the original-file limit can still be rejected after preparation.
Existing SVG context and returned artwork are limited to 2 MiB. Very
large pixel-vector output can use **Recreate from the image** without sending the
oversized SVG. The explicitly selected source image, its sanitized source filename,
bounded SVG and requested instructions are sent through the paired CLI to the
chosen provider. The full filesystem path is not included.

### Save, recolor and export

Saving creates an independent record containing the exact SVG, an immutable base
SVG, its source-image snapshot and provenance in the shared workspace. Retrying or
removing the conversion does not remove chosen artwork. Removing a conversion
folder moves saved artwork into **Uncategorized**, resolving name collisions.
Saved artwork is removed only through its own removal action.

In **Saved**, use the color picker or enter a six-digit hex value, then **Apply
color**. It changes vector fills/strokes while retaining transparency, clears the
old fidelity badge, and checks the actual color variant against the saved source.
An intentional color change normally has a nonzero difference count. **Original
colors** restores the exact immutable base bytes. Folio checks the restored shared
SVG against its retained source in this browser. Individual
SVG and ZIP downloads use the current saved color. Embedded-bitmap conversions
can also be saved with their exact source bytes, but are clearly non-recolorable.

Saved icons survive navigation and reload and are available to every authorized
Folio account using this workspace. Clearing a browser cache does not delete a
server-saved icon. Deleting saved artwork is a shared workspace action. Keep a ZIP
backup; server persistence does not promise indefinite retention or recovery after deletion.

### Settings, accounts and appearance

The footer cog opens a real Settings page. Profile, AI, Appearance, Workspace and
owner-only Accounts use left navigation and direct hash routes, such as
`#settings/appearance`. Back to library returns to the preceding workspace. The
Settings footer includes a real app-session logout action.

Folio registration/login is independent of the ChatGPT account used by the hosting
gate and the Codex account used by the optional AI companion. The owner completes
one-time setup by choosing a Folio email, name and password. Bootstrap is bound to
a configured trusted Site-owner subject; the first arbitrary visitor cannot
claim ownership. Passwords use salted native scrypt; opaque server sessions use
HttpOnly cookies, Secure on HTTPS, with SameSite=Lax. Sessions expire and can be
revoked. Profile updates save a display name; password changes verify the current
password and invalidate prior sessions/recovery links, replacing the current
browser session after success.

Owners create recipient-bound, expiring invitation links in Accounts. No email is
sent. A teammate registers with that link and gets the same files and organization,
not a personal data partition. The existing Site remains private: the teammate
also needs permission to open the hosted Site. An app invitation does not change
the hosting audience. Owner-only member management can disable a member and revoke
access. Member password recovery requires owner password confirmation; a locked-out
owner can initiate recovery through the separately verified Site-owner boundary.
Recovery links are single-use and revoke existing sessions when consumed.

Appearance controls accent, background, surfaces, text, secondary text and borders.
Draft colors preview locally. Save/Reset persists shared workspace colors; leaving
without saving restores the previous palette. Hex validation and text-contrast
checks reject unsafe or unreadable values. UI colors do not recolor SVG artwork,
imported HTML or the explicit light/dark/checker preview backgrounds.

### Existing browser files

Settings → Workspace inventories the old device-local Library and Icons data.
The explicit Share action stages the transfer and preserves original browser
records. IDs, folder relationships, filenames, sources, saved SVG base/current
colors and verification provenance are retained. Interrupted/conflicting writes
remain recoverable; retry uses stable IDs instead of duplicating successful items.
No historical browser media is automatically uploaded merely by signing in.

## Storage and import limits

The authenticated workspace uses one shared data set. D1 stores revisioned metadata,
accounts, membership and sessions; R2 stores immutable checksummed chunks. Server
acknowledgement is required before a change is shown as shared-saved. Stale writes
return a conflict instead of replacing another session's changes. Protected media,
including existing catalogue resources, use private/no-store responses and require
active membership. Logout unmounts private views and their object URLs.

The existing curated catalogue is reused without reuploading its original files.
New imports and shared organization use an additive overlay. View selection,
scroll/expansion, disposable thumbnails, worker claims and companion pairing stay
local. The old Library/Icon databases remain untouched through deliberate migration;
the transfer copies their records into the shared workspace.

Additive IndexedDB upgrades preserve existing HTML identifiers, screenshots and resource Blobs. Version 2 indexes imported images; version 3 adds a separate automatic-thumbnail cache. User folders contain organization metadata; original archive paths and linked assets never move.

| Boundary | Limit |
| --- | --- |
| Compressed ZIP | 256 MiB per ZIP |
| Google Drive remote file | 256 MiB per file |
| Extracted bytes | 768 MiB per import |
| Individual file | 128 MiB |
| Archive entries | 20,000 per recursive import |
| Nested ZIP depth | 8 levels beneath the outer ZIP |
| Direct image batch | 20,000 files, 768 MiB total, 128 MiB per image |

Shared metadata uses one atomic revisioned index (at most 1 MiB) and, for larger collections, a checksummed metadata manifest (at most 64 MiB). Small files share immutable chunk packs; larger files use chunks of at most 8 MiB. A dataset can reference at most 10,000 distinct chunks and contain at most 100,000 records in any one store, such as files or saved icons. This preserves the existing 20,000-entry per-import capability without sending every record inside the index. Reaching a shared-storage bound produces an explicit error and retains the staged change for review or retry. Available browser cache capacity also applies. Password-protected, split, ZIP64 and unsupported-compression archives are rejected. Server applications and native image conversions such as HEIC or TIFF are outside the supported scope.

HTML runs in an opaque sandbox with scripts enabled. Its resource bridge is scoped to its own archive. Imported scripts cannot access the workspace's document or storage through that frame, but may still make external network requests. Preview pages are content to inspect, not trusted application code.

## Development

The application uses React, TypeScript and Vite, with JSZip for archives, `idb` for storage, `es-module-lexer` for supported module references, and `html-to-image` for captures. Local tracing pins `vtracer-browser` 0.0.3, `imagetracerjs` 1.2.6 and `fit-curve` 0.2.0. See [implementation notes](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/implementation.md) for the existing Library data/preview boundaries and [third-party notices](THIRD_PARTY_NOTICES.md) for distributed tracing dependencies.

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite. In another terminal, run the checks and production build:

```sh
npm test
npm run build
```

`dev` and `build` first bundle the in-frame capture bridge. The build then embeds Vite's app assets in the Worker at `dist/server/index.js`; generated frontend assets are kept in ignored `.sites-runtime/`. The Worker uses the private R2 binding declared in `.openai/hosting.json`. Runtime secrets stay in Sites environment configuration. Builds and tests first run the repository privacy check; enable the local pre-commit hook as described in [PRIVACY.md](PRIVACY.md).

The [VTracer asset plugin](scripts/vtracer-assets.ts) serves and emits its pinned entry script, module worker and WASM together under `/vendor/vtracer/`, with license notices. ImageTracer and native alpha contour/cubic fitting share a local worker bundled through Vite. These are application assets from the same origin; the tracing engines require no remote tracing API or CDN model. The authenticated app uploads original images and completed results to its private shared workspace for persistence. Production verification must exercise the emitted worker/WASM paths as well as the development paths.

The focused tests cover archive structure, bounds, canonical identity, image classification, direct-image bytes, tree filtering, and organization projections. See [unit verification](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/unit-verification.md). Browser migration, rendered resources, screenshot pixels, keyboard interaction, download delivery and publication require their separate checks; passing Node tests does not establish those outcomes.

Run the converter and collection's focused checks with:

```sh
node --import tsx tests/png-svg.test.ts
node --import tsx --test tests/png-svg-trace.test.ts tests/png-svg-contours.test.ts tests/png-svg-curve-metrics.test.ts
node --import tsx --test tests/webp-input.test.ts
node --import tsx tests/icon-collection.test.ts
node --import tsx tests/icon-drop.test.ts
```

`tests/png-fixture-generator.ts` creates synthetic PNGs in code: opaque, fully transparent, partial-alpha, supersampled antialiased, actual 2-bit indexed `PLTE`/`tRNS`, multicolor and a 256-level alpha sweep. It also supplies the known 96 px silhouette, an independently resampled rings-and-lines regression, and their independent 4× references. Core checks independently reconstruct geometry and read back embedded bytes and ZIP contents. Trace checks cover alpha routing, deterministic settings and path validation; collection/drop checks cover identity, projection, admission and traversal. Actual browser rendering and IndexedDB transactions remain separate gates.

Prepare the development-only browser checks, then start the existing dev server:

```sh
node --import tsx scripts/prepare-png-svg-check.mjs
node --import tsx scripts/prepare-icon-library-check.mjs
node tests/shared-client-prepare.mjs
npm run dev
```

Use a dedicated local development origin for the browser checks:

| Page | Purpose |
| --- | --- |
| `/.qa/png-svg-check.html` | Native renderer checks, actual tracing engines, controlled fallback, curve-quality oracle, cancellation and downloadable report |
| `/.qa/icon-collection-check.html` | Real IndexedDB transactions, aborts, independent job owners, recovery and exact saved provenance in uniquely named QA databases |
| `/.qa/icon-library-check.html` | Actual shared-sidebar app, synthetic PNG/WebP/folder drops, responsive layout, reload/navigation and download-payload observations |
| `/tests/shared-client-runner.html` | Native IndexedDB migration, shared-save recovery, queue ownership and SVG checks in an ephemeral credentialless iframe; synthetic in-memory transport |

The interactive app harness adds procedural icons to that development origin. Synthetic directory-entry events test the app's import handling; they do not prove a physical operating-system drag gesture. Generated media and most harness HTML stay in ignored `.qa/`; the shared runner generates ignored `tests/shared-client-*.html` files. Save downloaded reports in `.qa/` or outside the checkout. The shared runner uses the existing server origin, requires credentialless-iframe support, refuses pre-existing Folio databases in its ephemeral partition and reports whether parent database names remain unchanged. These harnesses are outside the production entry graph. Record browser/version and the executed checks with results. Download-payload equality alone does not establish that the browser or operating system delivered the file.

The [revision-4 browser record](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/artifacts/revision-4-browser-verification.md) preserves observed passes, the initial failed silhouette candidate and remaining runtime gates. Passing Node tests or a development harness does not establish cross-browser/profile accuracy, complete UI behavior, production asset loading or publication.


## Published Site

https://folio-html-workspace.byronjacobs.chatgpt.site — private to its owner. This repository implements cloud-backed Library resources, fast image renditions, sorting, resizable shared navigation, folder favorites, canvas grids and a shared Icons collection with local conversion. The [task results](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/results.md) record implementation and publication evidence; source availability alone does not establish which revision is live.

## Source synchronization

The converter integration starts from native Sites source checkpoint
`05766c8d5511bcd7cf4b88f6cbf0a9a355c597db`, including published runtime source
`bd76663eca8e0d1539c7ea7b662c4b374cc56d42` (Site version 8).
GitHub retains its repository privacy safeguards. Private collection data,
screenshots, binary history exports and additional operational verification
reports are excluded from the transfer. Historical development documents in
this repository describe earlier revisions and are not a current publication
or access-policy record.

The additional WebP fixtures are generated locally with `python3 scripts/prepare-webp-fixtures.py` (Pillow with WebP support is a QA-only prerequisite, not an app dependency). The script records the actual encoded VP8/VP8L/VP8X layouts and creates opaque, alpha, monochrome, animated and corrupt-stream cases under ignored `.qa/webp/`. Run the separate `/.qa/webp-check.html` browser page after preparing it with the existing QA helper. Tests compare real decoded WebP references, original embedded bytes, strict native differences and explicit animation/decode failures. The interactive collection harness also supplies mixed PNG/WebP folder and loose-file drops for persistence and export checks. These QA assets are never shipped in the production app.

After generating the WebP QA inputs, also run `node --import tsx tests/webp-encoded.check.ts`. Its two real-encoded checks are deliberately separate from the self-contained default Node suite: they require the generated files and fail when those prerequisites are absent. The 23 structural WebP tests run from a clean checkout without Pillow or ignored fixture files.
