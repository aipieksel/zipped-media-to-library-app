# HTML and image workspace

**Repository privacy:** this repository is for application source. Keep imported
ZIPs, HTML, images and captures in private app storage. See [PRIVACY.md](PRIVACY.md)
for exclusions and the local pre-commit check.

A compact browser workspace for browsing exported HTML pages and images without unpacking each file by hand. Import several ZIPs together, including ZIPs inside ZIPs, drop supported image files directly, or paste a downloadable Google Drive file link. The application keeps imported files in this browser's IndexedDB storage.

## Using the workspace

1. Drop ZIPs or images anywhere in the workspace, use the **+** button beside the HTML and Images tabs, or use the Google Drive button to paste a share link for one downloadable ZIP/image. Drive folder links are not supported, and private files must be changed to “Anyone with the link” with downloads allowed. The one-line hint at the bottom of the sidebar is also an import button.
2. Select **HTML** or **Images**. Archive names and folders form the tree; HTML's supporting assets remain available without appearing in the HTML tree. An `index.html` or `index.htm` page uses its containing folder or archive name.
3. Use **Previous / Next** or **↑ / ↓** to cycle through all matching files in the current tab, including files beneath collapsed branches. Navigation wraps at either end. Search and Favorites narrow the same order used by the tree and gallery.
4. Star the current item, create a folder in the sidebar, or use **Move to folder**. HTML and images can belong to the same user folder. Choose **Original archive** in the move picker to return an item to its original tree position.
5. Open **Settings**, immediately before Gallery, for preview width, fit, screenshot mode and capture controls. The main workspace keeps one compact toolbar, with no branded header or large permanent drop area.

The sidebar occupies the full desktop height. On a narrow screen, the file-sidebar button opens it as a drawer.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| ↑ / ↓ | Previous / next matching HTML page or image, with wrap-around |
| Home / End | First / last matching file |
| ← / → in the tree | Collapse or expand a branch; move focus to a parent or first child |
| Enter / Space in the tree | Open the focused file or toggle the branch |
| `/` | Focus file search |
| Escape | Dismiss a dialog or popover; return focus from an HTML preview to the tree |

Page navigation does not take over arrow keys while editing a text input. Within live HTML, the preview bridge relays navigation keys when the page is not editing a field.

## Images, screenshots and downloads

The Images tab supports **PNG, JPEG, GIF, WebP, AVIF, SVG, BMP and ICO**. Image files inside HTML archives also become available there. The image viewer offers fit and actual-size presentation, dimensions, and a thumbnail gallery. SVG files are displayed through an image element, not inserted into the workspace's document as executable markup.

For HTML, **Settings → Capture current page** saves a PNG for the selected page. **Capture pages…** runs a serial background queue over the current search or Favorites results. Choose width, loading delay, full-page capture and whether to replace existing screenshots. You can continue browsing and cancel the queue; completed captures stay saved. A camera badge marks captured HTML pages. The screenshot gallery's **Open HTML** action returns to the exact source item.

The image download contains the original image bytes. The primary HTML download builds a ZIP containing the selected page's owning archive and retained resources, with original paths intact. The download button prepares the file and starts the browser download in one action. **Download HTML source only** is a separate Settings action for cases where linked files are not needed. Moving a page into a user folder does not change its download or break its relative assets.

Captures use an in-browser DOM renderer, not a remote Playwright service. Keep the tab open. External assets need network access and may be blocked by their source. Video, embedded frames, canvas effects, computed or scoped module loading, and some CSS can render or capture differently. Full-page capture stops at 12,000 pixels in height. The application shows resource or capture notices rather than claiming every export is fully compatible.

## Storage and import limits

Imports, screenshots, favorites, folders, and view preferences survive a normal refresh in the same browser profile and site. They are not cloud-synchronized. Clearing this site's browser data removes the workspace, so keep the original ZIPs and images. **Settings → Manage imports** lists all imports, including ones whose items have been moved into folders, and allows removal of one import and its associated captures and organization.

An additive IndexedDB v2 upgrade preserves existing HTML identifiers, screenshots and resource Blobs while indexing previously imported image files. User folders contain organization metadata; original archive paths and linked assets never move.

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

`dev` and `build` first bundle the in-frame capture bridge. Production output is `dist/`; ChatGPT Sites packaging and publication use the project configuration in `.openai/hosting.json` and the Sites workflow helper.

The focused tests cover archive structure, bounds, canonical identity, image classification, direct-image bytes, tree filtering, and organization projections. See [unit verification](documents/tasks/development/2026-10-26-00001-folio-html-archive-browser/artifacts/unit-verification.md). Browser migration, rendered resources, screenshot pixels, keyboard interaction, download delivery and publication require their separate checks; passing Node tests does not establish those outcomes.


## Published Site

https://folio-html-workspace.byronjacobs.chatgpt.site — private to its owner. Production build and deployment passed. The final live ZIP/SVG download check remains unverified because the QA browser did not complete ChatGPT sign-in; original PNG delivery and source ZIP byte/path checks passed. See the task results and browser report for the exact verification boundary.
