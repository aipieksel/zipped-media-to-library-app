# HTML and image workspace

**Repository privacy:** this repository is for application source. Keep imported
ZIPs, HTML, images and captures in private app storage. See [PRIVACY.md](PRIVACY.md)
for exclusions and the local pre-commit check.

A compact browser workspace for browsing exported HTML pages and images without unpacking each file by hand. A private Site-owned collection loads its metadata automatically and fetches resources as needed. ZIP, image and Google Drive imports remain in this browser's IndexedDB storage. Collection bytes and operational inventories are not bundled in this repository.

## Using the workspace

1. Drop ZIPs or images anywhere in the workspace, use the **+** button beside the HTML and Images tabs, or use the Google Drive button to paste a share link for one downloadable ZIP/image. Drive folder links are not supported, and private files must be changed to “Anyone with the link” with downloads allowed. The one-line hint at the bottom of the sidebar is also an import button.
2. Select **HTML** or **Images**. Archive names and folders form the tree; HTML's supporting assets remain available without appearing in the HTML tree. An `index.html` or `index.htm` page uses its containing folder or archive name.
3. Use **Previous / Next** or **↑ / ↓** to cycle through all matching files in the current tab, including files beneath collapsed branches. Navigation wraps at either end. Search and Favorites narrow the same order used by the tree and gallery.
4. Star a file or an entire folder. Click a folder's name to open its first matching file; use the separate arrow to expand or collapse it. Create folders or use **Move to folder** to organize HTML and images together. Choose **Original archive** in the move picker to return an item to its original tree position.
5. Open **Settings**, immediately before Gallery, for preview width, fit, screenshot mode and capture controls. The main workspace keeps one compact toolbar, with no branded header or large permanent drop area.

The sidebar occupies the full desktop height. Drag its separator to resize it, or focus the separator and use arrow keys, Home or End. Double-click resets its width. On a narrow screen, the file-sidebar button opens it as a drawer.

Sort alphabetically, newest/oldest, or by original image pixel area. Group by folders or month. Dates use available file metadata with labeled source/archive/import fallbacks. Image filters include landscape, portrait, square and unknown dimensions.

Both HTML and Images have canvas galleries. Choose Auto or 1–8 columns and rows, then page through the matching results. Image cards use small renditions when available. HTML cards show a saved capture first, or prepare an automatic thumbnail as that gallery page is browsed. Automatic thumbnails use a bounded, disposable browser cache.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| ↑ / ↓ | Previous / next matching HTML page or image, with wrap-around |
| Home / End | First / last matching file |
| ← / → in the tree | Collapse or expand a branch; move focus to a parent or first child |
| Enter / Space in the tree | Open the focused file or the folder's first matching descendant |
| `/` | Focus file search |
| Escape | Dismiss a dialog or popover; return focus from an HTML preview to the tree |

Page navigation does not take over arrow keys while editing a text input. Within live HTML, the preview bridge relays navigation keys when the page is not editing a field.

## Images, screenshots and downloads

The Images tab supports **PNG, JPEG, GIF, WebP, AVIF, SVG, BMP and ICO**. Image files inside HTML archives also become available there. The image viewer offers fit and actual-size presentation, dimensions, and a thumbnail gallery. SVG files are displayed through an image element, not inserted into the workspace's document as executable markup.

For HTML, **Settings → Capture current page** saves a PNG for the selected page. **Capture pages…** runs a serial background queue over the current search or Favorites results. Choose width, loading delay, full-page capture and whether to replace existing screenshots. You can continue browsing and cancel the queue; completed captures stay saved. A camera badge marks captured HTML pages. The screenshot gallery's **Open HTML** action returns to the exact source item.

The image download contains the original image bytes. The primary HTML download builds a ZIP containing the selected page's owning archive and retained resources, with original paths intact. The download button prepares the file and starts the browser download in one action. **Download HTML source only** is a separate Settings action for cases where linked files are not needed. Moving a page into a user folder does not change its download or break its relative assets.

Captures use an in-browser DOM renderer, not a remote Playwright service. Keep the tab open. External assets need network access and may be blocked by their source. Video, embedded frames, canvas effects, computed or scoped module loading, and some CSS can render or capture differently. Full-page capture stops at 12,000 pixels in height. The application shows resource or capture notices rather than claiming every export is fully compatible.

## Storage and import limits

Local imports, screenshots, favorites, folders, and view preferences survive a normal refresh in the same browser profile and site. They are not cloud-synchronized. Clearing this site's browser data removes those local items; keep your original ZIPs and images. The private Site-owned collection remains available. **Settings → Manage imports** removes a local import or hides a saved collection category on that browser; hiding does not delete server originals.

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

The application uses React, TypeScript and Vite, with JSZip for archives, `idb` for storage, `es-module-lexer` for supported module references, and `html-to-image` for captures. See [implementation notes](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/implementation.md) for the data and preview boundaries.

```sh
npm ci
npm run dev
npm test
npm run build
```

`dev` and `build` first bundle the in-frame capture bridge. The build then embeds Vite's app assets in the Worker at `dist/server/index.js`; generated frontend assets are kept in ignored `.sites-runtime/`. The Worker uses the private R2 binding declared in `.openai/hosting.json`. Runtime secrets stay in Sites environment configuration. Builds and tests first run the repository privacy check; enable the local pre-commit hook as described in [PRIVACY.md](PRIVACY.md).

The focused tests cover archive structure, bounds, canonical identity, image classification, direct-image bytes, tree filtering, and organization projections. See [unit verification](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/unit-verification.md). Browser migration, rendered resources, screenshot pixels, keyboard interaction, download delivery and publication require their separate checks; passing Node tests does not establish those outcomes.


## Published Site

https://folio-html-workspace.byronjacobs.chatgpt.site — private to its owner. The current source includes cloud-backed resources, fast image renditions, sorting, resizable navigation, folder favorites and canvas grids. Node tests and production builds do not establish browser visual fidelity, drag geometry, download completion or an actual browser database-migration journey; those checks remain separate.

## Source synchronization

The code is mirrored from native Sites source checkpoint
`05766c8d5511bcd7cf4b88f6cbf0a9a355c597db`, including published runtime source
`bd76663eca8e0d1539c7ea7b662c4b374cc56d42` (Site version 8).
GitHub retains its repository privacy safeguards. Private collection data,
screenshots, binary history exports and additional operational verification
reports are excluded from the transfer. Historical development documents in
this repository describe earlier revisions and are not a current publication
or access-policy record.
