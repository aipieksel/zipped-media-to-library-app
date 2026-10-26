# Archive viewer architecture consultation

Date: 2026-10-26. Scope: GA architect consultation for the current new ChatGPT Sites archive viewer. No application source was changed; no browser/runtime validation was performed in this consultation.

## Recommendation

Build a static browser application with a versioned IndexedDB workspace, asynchronous ZIP processing, a canonical archive/file/page model, a sandboxed `srcdoc` preview, and a sequential local snapshot queue. Keep original file bytes, then resolve and embed only resources needed by the selected page. Do not base the preview on a parent Service Worker: opaque-origin sandboxed iframes do not inherit that controller. Do not add `allow-same-origin` to solve a capture or resource problem.

The Sites capability/reference files inspected expose D1/R2 and a Cloudflare Workers runtime, but do not provision a Chromium/Browser Rendering binding. The current task can deliver browser-generated snapshots without a paid external service or secret. Label these as snapshots, not Playwright screenshots. They require the tab to remain open and cannot guarantee exact video/WebGL/remote-authenticated-frame capture. This is an implementation boundary to state plainly in help/final delivery.

Device-local persistence is appropriate for this viewing utility if described as saved in this browser. It is not cross-device storage or a durable backup. Do not add server upload/sync merely because it is available. If the parent has promised persistence across devices or cloud sessions, use Sites D1/R2 instead: that is a different storage boundary and must be reflected in the plan.

## Ownership and model

- `Archive`: stable generated ID, parent archive ID (nullable), original filename, original member/mount path, import status, compressed/expanded counters, imported timestamp.
- `File`: ID derived from archive ID plus canonical case-preserved member path, MIME, original Blob/bytes, size. Separate archive scopes prevent CSS/image names in two ZIPs colliding.
- `Page`: ID references the actual HTML File, display label, archive/folder ancestry, entry-point flag. Do not duplicate HTML bytes into tree nodes.
- `Snapshot`: page ID, content/resource version, capture viewport, engine version, creation time, status/error, PNG Blob. Gallery selection must reference the same Page ID used by the tree.
- Tree is a projection, not another persistence model. Show only ancestors leading to HTML pages or nested ZIP groups; retain every resource in the file store.

A folder containing only `index.html` can appear as a folder-named page leaf. If it has multiple HTML descendants, keep a disclosure group and show the actual index as one selectable page; do not replace or hide other HTML files. The ZIP filename is always the outer label. A root `index.html` is the default entry if present; if absent, select a deterministic first page without inventing an index file.

## Resource resolution

1. Canonicalise ZIP member separators, reject NULs, absolute/drive paths, duplicate canonical paths and traversal escaping the archive root. Retain case and Unicode spelling; reject or report collisions rather than overwriting. Ignore OS metadata such as `__MACOSX` from the tree, not by indiscriminately deleting legitimate files.
2. Resolve relative URLs from the requesting HTML/CSS/module file, stripping query/fragment only for byte lookup and preserving fragments where required. Decode URL paths carefully once. Keep root-relative paths within the current archive. A single packaging wrapper may be an inferred project root, but never global-match by basename across folders/archives.
3. Parse HTML with `DOMParser`. Rewrite resource-bearing attributes including `src`, stylesheet `href`, `srcset`, `poster`, SVG image references and inline style URLs. Remove or replace original `<base>` with a synthetic non-site origin so unresolved paths cannot accidentally target the viewer app. Track unresolved local references as diagnostics.
4. Recursively inline local CSS `@import` and rewrite every local CSS `url()` relative to that CSS file. Preserve import media conditions and guard cycles. Inline local CSS makes CSSOM/font access possible for capture. Binary images/fonts should use MIME-correct data URLs inside the opaque sandbox.
5. Preserve classic script order and attributes. Data-script URLs are simpler and preserve the external-script/defer behavior better than replacing every script with inline text. Remove obsolete integrity attributes after transformation. Ensure strings such as `</script>` cannot terminate injected bridge or JSON scripts.
6. ES module data URLs cannot resolve relative imports. For actual module support, parse with `es-module-lexer`, replace local static/literal dynamic specifiers with stable absolute synthetic IDs, and place a complete import map mapping those IDs to final data-script URLs before any module executes. This handles cycles without recursive data-URL expansion. Entry script `src` still needs the data URL because import maps do not affect `src`. Preserve existing bare-specifier maps. `import.meta.url`, computed dynamic imports, worker modules and build-time-only bare imports require explicit support/diagnostics; regex rewriting is not sufficient.
7. Inject a narrow local `fetch` adapter before page scripts: map local archive URLs to `Response` objects with correct MIME, status, text/json/arrayBuffer support. Pass genuinely external URLs to native fetch with credentials omitted. Do not pretend a POST/api backend exists. XHR, dynamic image/style URLs and runtime-added scripts require separate adapters if real fixtures use them; missing cases should be surfaced rather than silently rendering blank.

Parent-created blob URLs may work for some image/classic-script cases, but opacity/CORS and origin-partitioning make them a poor uniform strategy for fonts, module fetches and capture. Data URLs avoid those cross-origin reads at the cost of size; lazily embed per page, release old documents and avoid duplicating whole archives as base64.

## Preview and snapshot isolation

Use `<iframe sandbox="allow-scripts">` without same-origin, top-navigation, popups or forms. Keep uploaded code out of the app DOM. Validate bridge messages by exact `event.source`, generation/request token and a small payload schema. Accept only current-page readiness, capture result, bounded diagnostic and local-page-navigation messages. The child must not trigger workspace deletion, uploads or privileged requests. A token does not make arbitrary page code trusted.

The capture code runs inside the child document. Prefer `html-to-image` for the first runtime proof because its documented algorithm clones within the document and serialises a self-contained SVG foreignObject before rasterisation. `html2canvas-pro` may work, but its document-clone iframe can be incompatible with the opaque sandbox; verify rather than adding same-origin. Bundle the capture library and bridge as inline code; do not depend on CDN availability for core operation.

Use an offscreen iframe with a real width/height (not `display:none`), wait for page-ready, fonts and images with bounded timeouts, wait two animation frames, then capture at a defined viewport. Serialize captures; save each result before advancing. Report queued/running/succeeded/failed/cancelled counts. Cancellation stops scheduling new pages and ignores stale results. Show errors per page, allow retry, and never mark a failed or zero-byte capture as generated. A capture-ready status is not a pixel-fidelity guarantee; visually inspect real samples.

## Bounded processing and recovery

ZIP import should be asynchronous or in a Worker. Enforce limits on actual extracted bytes as well as declared sizes, total entries and nesting depth; report the particular file/archive and retain already successful independent imports. Avoid extracting everything eagerly to base64. Reject encrypted/unsupported/completely corrupt ZIPs with a useful error. Use per-archive staging/atomic commit so a failure does not leave a successful-looking partial tree. Use a Map or null-prototype dictionary for filenames to avoid `__proto__` and similar keys mutating application objects.

Store selected Page ID, expanded group IDs, view mode and filter consistently. A reload must not create duplicate archives. Removing an archive deletes only its descendants and snapshots, then selects the next valid page. Unknown schema versions must not clear the user's data.

## Decisive tests

1. Real Library ZIP with external CSS, local JS, SVG/image and font: verify visible render and a JS-driven interaction, not only HTML count.
2. Synthetic outer ZIP with two inner ZIPs, plus outer root HTML; inner folders each have `index.html` and identical `assets/style.css` filenames with visibly different styles. Assert all pages reachable, isolation correct and assets hidden.
3. CSS `@import`, parent-relative `url()`, spaces/Unicode filenames, query/fragment, root-relative resources, and `srcset`. Assert concrete computed styles/image sizes.
4. Module pair plus a cycle and local JSON fetch if those are claimed supported. Inspect visible output and console; do not infer support from rewriting strings.
5. Up/down navigation while tree focused, left/right disclosure, Home/End; typing in search and editing inside preview must not unexpectedly switch pages. Selection should scroll into view. Snapshot-to-HTML opens and reveals exactly the matching node.
6. Queue multiple captures, cancel, retry one failure, toggle gallery, reload. Verify persisted PNG dimensions/nonzero bytes and visual content. Missing fonts/images and tainted canvas must produce truthful limitations/errors.
7. Hostile HTML attempts parent DOM/storage access, popup and top navigation. Expected blocked. Forged messages from unrelated iframe/source are ignored. Traversal, duplicate paths, corrupted ZIP, excessive nesting and decompression cap produce explicit errors without altering existing imports.
8. IndexedDB reload round trip retains stable IDs, bytes, tree expansion and snapshot links; concurrent capture/import and rapid selection never attach a stale snapshot or page to the new selection.

## Primary evidence inspected

- Local Sites SKILL.md and `references/storage.md` / `identity-and-secrets.md`: documented bindings and Worker environment; no Browser Rendering provision found in the plugin tree.
- WHATWG iframe/Service Worker issue (open proposal): https://github.com/whatwg/html/issues/10585 — opaque sandbox controller incompatibility, not an implemented fix.
- HTML Standard iframe sandbox semantics: https://html.spec.whatwg.org/dev/iframe-embed-object.html
- MDN module URL resolution: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import — data URL relative import limitation.
- MDN import maps: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap — processed before importers; not applied to script src/worker modules.
- Capture library source README: https://github.com/bubkoo/html-to-image — DOM clone/SVG/canvas mechanism, data URI and tainted-canvas limitations; MIT licence.
- Module lexer: https://github.com/guybedford/es-module-lexer — suitable for lexical import rewriting, MIT licence.

Browser behavior remains a required runtime proof owned by the parent. No runtime success is claimed here.
