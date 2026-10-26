# Implementation — revision 3

## Scope and status

This document records the implemented source for the same Folio task and ChatGPT Site. S1 supplied the recursive ZIP/HTML browser and screenshot requirements. S2 explicitly replaced the spacious branded shell with a compact full-height sidebar and added images, favorites, user folders, moves and downloads. The earlier visual concept is historical evidence, not the revision 3 acceptance target. The reviewed revision 3 plan governs this continuation.

At this documentation pass, the current source is implemented and 22 focused Node assertions have passed. Root owns final browser verification, the revised download-delivery check, production build, source packaging and deployment. This document does not claim those pending gates passed. The original HTML browser/capture observations are recorded separately in [results.md](results.md).

## Compact application shell

[`src/App.tsx`](../../../../src/App.tsx) and [`src/styles.css`](../../../../src/styles.css) implement a 248-pixel desktop sidebar spanning the viewport height, HTML/Images tabs, compact search and tree controls, a scrolling tree, and a 26-pixel bottom strip containing the single-line drop hint. The workspace accepts drops across its shell. The main content has one 40-pixel toolbar and small canvas gutters. No logo, extra global header, visible reload control or permanent capture/device toolbar remains.

The toolbar contains previous/next navigation and position, current item context, favorite, move, download, Settings and Gallery. Settings contains fit, HTML preview width, live/screenshot mode, current/batch captures, source-only HTML export and import management. A narrow viewport turns the sidebar into a drawer. Modal/popover controls have labels, dismissal handling and focus restoration; the actual keyboard and narrow-layout evidence is a browser-verification responsibility.

The UI derives a single ordered item list from `buildOrganizedTree` → `filterTree` → `getPageOrder`. Search, favorites, tree, navigation, galleries and batch targets consume that projection. Collapse state only affects presentation; it does not limit navigation. Previous/next and Up/Down wrap at the first and last matching item. Input, editable-field, modifier-key and open-dialog guards protect editing and modal interaction.

## Canonical items and archive boundaries

[`src/types.ts`](../../../../src/types.ts) retains the original `HtmlPage` structure and adds an optional `kind: 'html' | 'image'` discriminator. Missing kind means legacy HTML. Both kinds keep the canonical `${archiveId}/${path}` identity of their underlying `ArchiveFile`; snapshots remain keyed by HTML item ID. `ArchiveMeta.pageCount` continues to count HTML, while `imageCount` counts supported images, including descendants.

[`src/archive.ts`](../../../../src/archive.ts) keeps the verified recursive extraction boundary: raw central/local header inspection precedes JSZip normalization, and streaming extraction checks declared and actual size plus CRC. Unsafe paths, canonical collisions, inconsistent headers, overlapping entries, symlinks, encrypted/split/ZIP64 input and unsupported compression reject the import. Limits remain 256 MiB compressed per ZIP, 768 MiB expanded per recursive import, 128 MiB per member, 20,000 entries and eight nested ZIP levels. Each ZIP runs in the existing worker; the shell imposes a 120-second extraction timeout. Separate selected ZIPs are saved independently, and a failing ZIP does not undo successful sibling imports.

Each nested ZIP gets its own archive ID and resource map. HTML and supported image metadata become items; CSS, JavaScript, fonts and other resources remain retained files. The HTML view hides images/assets from its navigation tree while keeping them available to the page. The Images view includes supported image members, including resources from HTML exports.

Direct images use `importImages`. A batch creates one named archive, preserves original file bytes and filenames, assigns supported image MIME types and enforces count/size/path/duplicate/empty-file checks. Supported extensions are PNG, JPEG, GIF, WebP, AVIF, SVG, BMP and ICO. Classification is extension-based; the native image element performs decoding and reports a load error for corrupt or unsupported bytes. No conversion service is introduced.

## Additive persistence and organization

[`src/db.ts`](../../../../src/db.ts) opens the existing `folio-workspace` database at version 2. The upgrade creates only the new `folders` and `organization` stores. It walks existing file records with an IndexedDB cursor and adds supported image item metadata using the existing IDs, archive relationship, path and Blob size. It does not call `Blob.text()` or `Blob.arrayBuffer()`, replace resource Blobs, rewrite original HTML items, or delete/reset the database. Image counts are accumulated through archive ancestors. Upgrade errors abort the version-change transaction and propagate the failure.

Startup reads archive/item metadata, organization, folders and stored snapshots. Resource file bodies remain out of normal startup reads. `getArchiveFiles` supplies one archive's resources for HTML; `getFile` supplies one original image or source file.

`WorkspaceFolder` is a flat named collection. `ItemOrganization` holds an item ID, favorite boolean and nullable folder ID. Folder creation trims and normalizes the name, rejects empty/control/overlong names, and rejects case-insensitive duplicates within a readwrite transaction. `setItemFavorite` verifies item existence and preserves its folder assignment. `moveItemsToFolder` verifies the target folder and every item, preserves favorite state, and writes the whole requested move transactionally. A failure aborts that operation.

[`src/tree.ts`](../../../../src/tree.ts) projects assigned items under user folders and leaves unassigned items under their original archive hierarchy. Empty user folders remain visible; archive branches with no items in the current kind/favorites view are pruned. Moving an item changes this projection only. Its ID, `archiveId`, path, original Blob and linked resources stay unchanged. Returning it to Original archive restores the archive projection. Removing an import deletes only that root's archive/file/item/snapshot/organization records and retains unrelated imports and user folders.

The data remains browser-local. Refresh persistence does not imply synchronization, cloud backup, or survival after browser site-data removal. Original files should remain the user's backup.

## HTML rendering and capture

[`src/preview.ts`](../../../../src/preview.ts) prepares one selected HTML page against its own archive map. It rewrites supported local resource references, compiles linked and inline CSS imports/URLs, detects circular stylesheets, and resolves supported static/literal dynamic module imports and import-map mappings. A synthetic archive origin separates local references from the viewer origin. The in-frame bridge handles supported dynamic image/script/style attributes, archive-local fetch, local HTML links and navigation keys. Computed imports, scoped import maps and embedded frames have explicit compatibility limitations.

Live and capture frames use `sandbox="allow-scripts"` without same-origin access. [`src/frame.ts`](../../../../src/frame.ts) binds messages to the exact frame window and per-generation channel, validates message types and resource path shapes, and caps concurrent resource requests. The resource API only resolves members of the selected archive. Imported HTML is never inserted into the workspace's parent document. External requests remain possible from imported scripts; isolation is not a network-blocking promise.

[`src/capture.ts`](../../../../src/capture.ts) creates a disposable sandbox frame for each HTML screenshot. Preparation has a 20-second timeout; frame capture has a separate 35-second timeout and abort cleanup. The bridge waits for fonts/images within bounds, applies the chosen delay, freezes animations in that disposable frame and uses `html-to-image` to produce a PNG. Full-page height is capped at 12,000 pixels. Capture messages are checked for shape, dimensions, Blob type/size and PNG signature, and storage confirms the HTML item still exists before writing.

The shell runs captures serially, keeps navigation available, reports progress and failures, and retains completed captures after cancellation. Camera badges and screenshot gallery links use canonical IDs. The Images tab uses original images directly and does not enqueue HTML captures.

These are browser DOM captures, not remote Playwright screenshots. External CORS restrictions, unavailable fonts/images, video, embedded frames, canvas and some rendering effects can affect the result. Failures or notices remain visible; the implementation does not promise pixel equality for every HTML export.

## Image presentation and downloads

`ImageViewer` uses a Blob object URL in an image element, supports fit/actual-size rendering and displays dimensions/load failure. `ImageGallery` loads thumbnails near visibility and releases its Blob URLs on cleanup. SVG is displayed as an image, not executed in the workspace DOM.

The download contract preserves originals: an image export contains its stored Blob bytes; HTML's primary export rebuilds a ZIP from its owning archive's retained files and original paths; source-only HTML is explicitly separate. The revised helper returns a prepared Blob and filename, and the application exposes a visible native **Save file** anchor in a Download ready dialog so the final user gesture initiates the download. Browser delivery must be verified against that final handler; no successful revised download is inferred from source inspection or ZIP-generation logic.

## Verification boundaries

[unit-verification.md](unit-verification.md) records the 14 archive and eight tree assertions. The real nested Library fixture continues to reconcile to 12 HTML pages and now also indexes 102 images. Those tests establish structural/classification/resource-retention facts, not browser rendering or migration success.

The existing revision 2 browser evidence includes live linked assets, compatibility fixture assertions, captures with actual PNG output, sandbox parent-access denial, keyboard field protection and refresh persistence. Revision 3 must separately establish retention of the existing 19 HTML items and seven screenshots during upgrade, image rendering, compact layout, wrap navigation, folder/favorite persistence and final download delivery. Production build and native Sites publication remain distinct final gates.
