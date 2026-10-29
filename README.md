# Folio · HTML, images and icons

**Repository privacy:** this repository is for application source. Keep imported
ZIPs, HTML, images and captures in private app storage. See [PRIVACY.md](PRIVACY.md)
for exclusions and the local pre-commit check.

A compact browser workspace for browsing exported HTML pages, images and local PNG-to-SVG icons. A private Site-owned collection loads its metadata automatically and fetches resources as needed. ZIP, image and Google Drive imports remain in this browser's IndexedDB storage. Icons have their own local collection of original PNGs and generated SVGs. Collection bytes and operational inventories are not bundled in this repository.

Use the top **HTML / Images / Icons** tabs. All three use the same file sidebar, tree, search, sorting, Favorites and previous/next navigation. Icons extends that workspace with conversion controls in the canvas toolbar; it has no separate converter sidebar. HTML and Images retain the existing Library tools and collection.

## Using the workspace

1. In **HTML** or **Images**, drop ZIPs or images anywhere in the workspace, use the sidebar's **+** button, or use the Google Drive button to paste a share link for one downloadable ZIP/image. Drive folder links are not supported, and private files must be changed to “Anyone with the link” with downloads allowed. The one-line hint at the bottom of the sidebar is also an import button. In **Icons**, the same import controls accept local PNGs and folders; see [local PNG to SVG conversion](#local-png-to-svg-conversion).
2. Select **HTML** or **Images**. Archive names and folders form the tree; HTML's supporting assets remain available without appearing in the HTML tree. An `index.html` or `index.htm` page uses its containing folder or archive name.
3. Use **Previous / Next** or **↑ / ↓** to cycle through all matching files in the current tab, including files beneath collapsed branches. Navigation wraps at either end. Search and Favorites narrow the same order used by the tree and gallery.
4. Star a file or an entire folder. Click a folder's name to open its first matching file; use the separate arrow to expand or collapse it. Create folders or use **Move to folder** to organize HTML and images together. Choose **Original archive** in their move picker to return an item to its original tree position. Icons uses its own nested folders in the same tree interface; **Uncategorized** is its permanent destination for loose PNGs.
5. In HTML and Images, open **Settings**, immediately before Gallery, for preview width, fit, screenshot mode and capture controls. Icons keeps mode, zoom, transparency background, queue controls and ZIP export in its canvas toolbar. The main workspace has no large permanent drop area.

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

Shared file navigation works in all three tabs. Shortcuts do not take over arrow keys while editing a text input. The top tab list also supports Left/Right and Home/End. Within live HTML, the preview bridge relays navigation keys when the page is not editing a field.

## Images, screenshots and downloads

The Images tab supports **PNG, JPEG, GIF, WebP, AVIF, SVG, BMP and ICO**. Image files inside HTML archives also become available there. The image viewer offers fit and actual-size presentation, dimensions, and a thumbnail gallery. SVG files are displayed through an image element, not inserted into the workspace's document as executable markup.

For HTML, **Settings → Capture current page** saves a PNG for the selected page. **Capture pages…** runs a serial background queue over the current search or Favorites results. Choose width, loading delay, full-page capture and whether to replace existing screenshots. You can continue browsing and cancel the queue; completed captures stay saved. A camera badge marks captured HTML pages. The screenshot gallery's **Open HTML** action returns to the exact source item.

The image download contains the original image bytes. The primary HTML download builds a ZIP containing the selected page's owning archive and retained resources, with original paths intact. The download button prepares the file and starts the browser download in one action. **Download HTML source only** is a separate Settings action for cases where linked files are not needed. Moving a page into a user folder does not change its download or break its relative assets.

Captures use an in-browser DOM renderer, not a remote Playwright service. Keep the tab open. External assets need network access and may be blocked by their source. Video, embedded frames, canvas effects, computed or scoped module loading, and some CSS can render or capture differently. Full-page capture stops at 12,000 pixels in height. The application shows resource or capture notices rather than claiming every export is fully compatible.

## Local PNG to SVG conversion

Open **Icons** and drop PNGs or folders onto the canvas or sidebar, use the sidebar's **+** or folder-import button, or choose **Import PNGs / Import folder** in the empty state. Original PNG bytes and queued entries are saved locally before conversion starts automatically. Loose files enter the persistent **Uncategorized** folder. Folder imports retain their hierarchy, including distinct roots with the same name; safe suffixes resolve display and export-name collisions.

Directory drops preserve empty folders when the browser exposes directory entries. A file-only folder chooser can preserve the paths of files it returns, but cannot report empty folders. Unsupported files, unreadable entries and admission limits produce import notices rather than silently merging unrelated folders. The [import implementation](src/icon-drop.ts) defines the supported directory-entry and picker paths.

Select an icon in the shared tree to compare the saved original and generated SVG. The previews use a common scale and synchronized scrolling. Choose **Fit**, **100% · native**, **200%** or **400%**, and checkerboard, light or dark transparency backgrounds. **Show source pixels** enables nearest-neighbor inspection of the original PNG; it does not change the SVG or the native fidelity check.

The mode selector applies to the selected icon immediately and becomes the saved default for new imports. Existing icons retain their own mode until reconverted. **Stop this icon** cancels one job; **Stop (n)** cancels pending work without removing completed results. Stopped or failed entries retain their original PNG for **Convert again**. Removing an icon or folder removes its saved local copies after confirmation; files on disk are unaffected.

- **Pixel vectors · exact grid** is the default. Browser-decoded RGBA pixels become editable SVG rectangles. Adjacent pixels with identical color and opacity merge into non-overlapping shapes. Dimensions, transparency and antialiased edge opacity are retained without tracing, resizing or color quantization. These shapes preserve the pixel grid and still look pixelated when enlarged.
- **Smooth curves · approximate** fits editable paths to the decoded image. Shapes, colors, edge coverage or small details may change. The result shows the actual tracing engine and native differing-pixel count; it does not promise exact recovery of an original drawing. Smooth mode has a smaller workload budget and never silently reduces the source dimensions.
- **Embedded PNG · bitmap** places the original PNG bytes inside an SVG image element. It is a bitmap inside an SVG, not editable vector artwork. Choose it when pixel geometry is impractically large or original PNG bytes matter. Conversion never silently changes between these three modes, and file/output limits still apply.

**Download SVG** saves the selected result. **Download ZIP (n)** exports ready icons in the current search/Favorites view; its count excludes unfinished, cancelled and failed entries. Filter the collection to make a smaller export when needed. Output names preserve source basenames where safe, with suffixes for case-insensitive and Unicode-equivalent collisions. Originals and generated results remain saved after a download.

### How smooth tracing is selected

All tracing runs locally. The [browser adapter](src/png-svg-browser.ts) and [trace profiles](src/png-svg-trace.ts) use these routes:

| Decoded source | Selected local engine |
| --- | --- |
| Fully opaque image | VTracer through pinned `vtracer-browser` 0.0.3; if it cannot complete, an explicit warning identifies the ImageTracer result used instead |
| One opaque foreground color with a narrow antialiased fringe and transparent background | ImageTracer 1.2.6 fits the half-alpha silhouette contour, then restores the foreground color |
| Other transparency, translucent interiors, soft alpha fields, multicolor transparency or a fully transparent image | ImageTracer 1.2.6 with a deterministic RGBA palette |

The conservative silhouette detector rejects arbitrary translucent fills, broad alpha gradients and distinct foreground colors. Thresholding is confined to that detected silhouette route; it is never applied to Pixel vectors or general RGBA tracing. VTracer's RGB-only output is used only for fully opaque source pixels. ImageTracer uses no added strokes, blur or small-path omission; its palette is bounded, so complex images may still lose color detail.

The route choice was informed by a **procedural** 96 × 96 silhouette containing a curved hole, a separate island and a thin stroke. In the recorded Chrome 155 development experiment, ImageTracer reduced mean absolute alpha error at 400% from **2.7149 to 1.7295** against an independently sampled analytic reference: approximately **36.3% lower error**, while preserving the required components, hole and thin stroke. The initial VTracer silhouette result was worse than the pixel baseline and was removed from routing. This is evidence about one synthetic fixture and browser, not a general accuracy promise for arbitrary artwork. See the [measured comparison and browser verification status](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/artifacts/revision-4-browser-verification.md).

### What “Pixel match verified” means

Each generated SVG is rendered at the PNG's native dimensions and compared with the decoded source on a transparent **8-bit RGBA sRGB canvas in the current browser**. The check uses the actual downloadable SVG, independent of preview zoom, background or device-pixel ratio. A pixel differs if alpha changes, or if any RGB channel changes while either alpha is nonzero. RGB is ignored only when both alphas are zero; there is no tolerance.

**Pixel match verified** appears only for zero differing pixels. Other results show the differing-pixel count or **Pixel check unavailable** with an explanation. A generated SVG remains available when verification cannot complete. Smooth output follows the same strict rule; approximate curves do not receive a tolerance-based exactness badge.

Each result saves the check timestamp, browser, engine/version and native **sRGB RGBA8** context alongside the exact SVG. After reopening, the UI labels it a **Saved native-size check**; it is historical evidence, not a fresh test in the newly opened browser. Use **Convert again** for a new conversion and check. PNG color metadata and 16-bit sources receive scope warnings: the check uses the browser's 8-bit sRGB reference, while embedded mode retains the original file bytes. This does not certify every browser, color profile or original 16-bit channel value. Smooth, editable curves cannot generally be recovered exactly from arbitrary PNGs.

### Converter storage and limits

Original PNGs, generated SVGs, nested folders, favorites, conversion state and view preferences persist in the separate local **`folio-icons` IndexedDB** database. They are not uploaded to the Site collection or Google Drive. Switching tabs and normal reloads retain them. Startup reads metadata and loads source/output Blobs as needed rather than keeping the entire collection decoded in memory.

Queued work resumes automatically while the app is open. Interrupted processing can resume after its prior claim expires; a second tab does not take over a live job. Explicitly stopped and failed jobs stay stopped until **Convert again**. Claims and revision checks prevent an old conversion from restoring a deleted or superseded result. Storage or quota failures are shown instead of reporting an unsaved result as ready. See the [collection storage](src/icon-collection.ts) and [queue controller](src/useIconCollection.ts).

| Boundary | Limit |
| --- | --- |
| Source PNG | 20 MiB per file |
| Native dimensions | 4096 px per side and 4,194,304 total pixels |
| Pixel vector complexity | 150,000 merged rectangles |
| Smooth input | 1024 px per side and 262,144 total pixels |
| Smooth output complexity | 20,000 paths and 200,000 path commands |
| ImageTracer palette | Up to 64 RGBA colors |
| Smooth worker operation | 45 seconds per engine attempt, with cancellation |
| Individual SVG | 24 MiB |
| One import | 100 PNGs and 100 MiB of accepted source bytes |
| Folder traversal | 5,000 entries, including folders/non-PNG files, and 32 path levels |
| One ZIP export | 128 MiB of generated SVG input bytes |

Static PNGs only; animated PNGs are rejected. Invalid, oversized or excessively complex files produce actionable errors without silent downscaling. The 100-file limit applies to each import, not the saved collection's lifetime. Total saved data is limited by browser storage quota, shared with the site's other local data. Clearing site data or browser eviction can remove local icons; keep your originals and useful exports.

## Storage and import limits

Library imports, screenshots, favorites, folders, and view preferences survive a normal refresh in the same browser profile and site. They are not cloud-synchronized. Clearing this site's browser data removes those local items; keep your original ZIPs and images. The private Site-owned collection remains available. **Settings → Manage imports** removes a local import or hides a saved collection category on that browser; hiding does not delete server originals. Icons has the separate local database and removal controls described above; its data is not part of the private Site-owned collection.

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

There is no fixed import-count limit; available browser storage is the practical limit. Password-protected, split, ZIP64 and unsupported-compression archives are rejected. Server applications and native image conversions such as HEIC or TIFF are outside the supported scope.

HTML runs in an opaque sandbox with scripts enabled. Its resource bridge is scoped to its own archive. Imported scripts cannot access the workspace's document or storage through that frame, but may still make external network requests. Preview pages are content to inspect, not trusted application code.

## Development

The application uses React, TypeScript and Vite, with JSZip for archives, `idb` for storage, `es-module-lexer` for supported module references, and `html-to-image` for captures. Local tracing pins `vtracer-browser` 0.0.3 and `imagetracerjs` 1.2.6. See [implementation notes](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/implementation.md) for the existing Library data/preview boundaries and [third-party notices](THIRD_PARTY_NOTICES.md) for distributed tracing dependencies.

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

The [VTracer asset plugin](scripts/vtracer-assets.ts) serves and emits its pinned entry script, module worker and WASM together under `/vendor/vtracer/`, with license notices. The ImageTracer worker is bundled through Vite. These are application assets from the same origin; conversion requires no remote tracing API, CDN model or image upload. Production verification must exercise the emitted worker/WASM paths as well as the development paths.

The focused tests cover archive structure, bounds, canonical identity, image classification, direct-image bytes, tree filtering, and organization projections. See [unit verification](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/unit-verification.md). Browser migration, rendered resources, screenshot pixels, keyboard interaction, download delivery and publication require their separate checks; passing Node tests does not establish those outcomes.

Run the converter and collection's focused checks with:

```sh
node --import tsx tests/png-svg.test.ts
node --import tsx tests/png-svg-trace.test.ts
node --import tsx tests/icon-collection.test.ts
node --import tsx tests/icon-drop.test.ts
```

`tests/png-fixture-generator.ts` creates synthetic PNGs in code: opaque, fully transparent, partial-alpha, supersampled antialiased, actual 2-bit indexed `PLTE`/`tRNS`, multicolor and a 256-level alpha sweep. It also supplies the known 96 px silhouette and independent 4× reference. Core checks independently reconstruct geometry and read back embedded bytes and ZIP contents. Trace checks cover alpha routing, deterministic settings and path validation; collection/drop checks cover identity, projection, admission and traversal. Actual browser rendering and IndexedDB transactions remain separate gates.

Prepare the development-only browser checks, then start the existing dev server:

```sh
node --import tsx scripts/prepare-png-svg-check.mjs
node --import tsx scripts/prepare-icon-library-check.mjs
npm run dev
```

Use a dedicated local development origin for the browser checks:

| Page | Purpose |
| --- | --- |
| `/.qa/png-svg-check.html` | Native renderer checks, actual tracing engines, controlled fallback, curve-quality oracle, cancellation and downloadable report |
| `/.qa/icon-collection-check.html` | Real IndexedDB transactions, aborts, independent job owners, recovery and exact saved provenance in uniquely named QA databases |
| `/.qa/icon-library-check.html` | Actual shared-sidebar app, synthetic PNG/folder drops, responsive layout, reload/navigation and download-payload observations |

The interactive app harness adds procedural icons to that development origin. Synthetic directory-entry events test the app's import handling; they do not prove a physical operating-system drag gesture. Generated HTML and PNG fixtures stay in ignored `.qa/`; save downloaded reports there or outside the checkout. These harnesses are outside the production entry graph. Record browser/version and the executed checks with results. Download-payload equality alone does not establish that the browser or operating system delivered the file.

The [revision-4 browser record](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/artifacts/revision-4-browser-verification.md) preserves observed passes, the initial failed silhouette candidate and remaining runtime gates. Passing Node tests or a development harness does not establish cross-browser/profile accuracy, complete UI behavior, production asset loading or publication.


## Published Site

https://folio-html-workspace.byronjacobs.chatgpt.site — private to its owner. This repository implements cloud-backed Library resources, fast image renditions, sorting, resizable shared navigation, folder favorites, canvas grids and the persistent local Icons collection. The [task results](documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/results.md) record implementation and publication evidence; source availability alone does not establish which revision is live.

## Source synchronization

The converter integration starts from native Sites source checkpoint
`05766c8d5511bcd7cf4b88f6cbf0a9a355c597db`, including published runtime source
`bd76663eca8e0d1539c7ea7b662c4b374cc56d42` (Site version 8).
GitHub retains its repository privacy safeguards. Private collection data,
screenshots, binary history exports and additional operational verification
reports are excluded from the transfer. Historical development documents in
this repository describe earlier revisions and are not a current publication
or access-policy record.
