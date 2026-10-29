# Revision 3 — shared navigation and durable local icon collection

Assessor: `/root/codebase_assessment`. Read-only application assessment; this artifact and the separate revision-3 workflow selection are the only assigned writes. Inspection completed on 2026-10-29 against checkout HEAD `b66763e4be353bb17827e7da27b4ebf9783e15b5`; the worktree was clean when the baseline was read. No application edits, installs, tests, builds, browser operations or Git mutations were performed for this assessment.

## Governing scope change

The coordinator's current user-revision assignment requests **one existing Library sidebar/tree**, with **HTML, Images and Icons in the top navigation**, converter controls in the canvas toolbar, automatic conversion on drop, preserved dropped-folder hierarchy, a persistent Uncategorized destination for loose PNGs, and durable browser-local icons. The previous conversion engine, two output modes, native-size comparison, safe exports, source-only Git policy and same private Site remain applicable.

This revision supersedes the revision-2 decisions to keep inputs only in tab memory, place mode controls in a separate converter sidebar, and exclude all local persistence. It does not authorize cloud uploads, a cloud schema change, deletion/reset of the existing Library database, or a new visual system. The old assessment, plan and verification remain historical evidence; they are not proof that the revised storage/navigation behavior works. The coordinator owns exact source-request capture, plan revision and new independent admission.

## Confirmed ownership contract

| ID | Scoped requirement | Existing analogue / source evidence | Convention / owner to reuse | Plan constraint / decisive verification |
| --- | --- | --- | --- | --- |
| R3-C1 | Replace the two workspace buttons with HTML, Images, Icons | `App.tsx`: `workspace`, `kind`, `switchWorkspace`, `switchKind`, top `.workspace-navigation`, sidebar `.kind-tabs` | App is the sole top-level navigation/state coordinator. Introduce a presentation tab union separate from persisted `ItemKind`. | Move the existing file-type controls to the top bar; do not leave duplicate tabs in the sidebar. Preserve legacy `#png-to-svg` as an Icons alias, and retain the last Library tab for `#library` if compatible. Test direct links, back/forward, tab switches and counts. |
| R3-C2 | Use the exact existing sidebar | `App.tsx` contains `.sidebar`, search, `.tree-actions`, `.sidebar-scroll`, footer, resizer and narrow-screen drawer; `ArchiveTree.tsx` is the sole tree renderer | Keep one sidebar DOM/component owner and one `ArchiveTree` instance driven by the active collection. Existing CSS/tokens, resize, focus trap, disclosure behavior and virtualization remain authoritative. | Remove the converter-specific sidebar/list. No lookalike replacement. Exercise the same search, favorites, folder opening, collapse/expand, resize and mobile drawer on all three tabs. |
| R3-C3 | Keep Library data and preferences intact | `App.tsx` hydration calls `listWorkspace` plus `getPreference('workspace')`; its preferences contain HTML/Image selection, expansion, viewport, fit, orders, grids, width and shape. `refreshCloud` merges local metadata while cloud fetches finish. | Leave Library arrays, selected IDs and existing `workspace` preference shape owned by App/db. Keep icons' preferences in an explicit isolated preference record. | Do not let Icons overwrite `workspace.kind` with an unsupported value, or overwrite remembered Image selection merely because tree adapters have `kind:'image'`. HTML and Images must reopen their previous item and keep folders/favorites after Icons use and reload. |
| R3-C4 | Durable on-device collection without cloud changes | `db.ts` opens `folio-workspace` version 3 and validates only HTML/Image import bundles; `cloud.ts` validates the same remote union; `getFile` can fetch cloud resources | Recommend a dedicated `folio-icons` IndexedDB database and data-access module using installed `idb` 8.0.3. Keep the existing Library DB version and cloud contract unchanged. | Icon persistence must import neither `db.ts`, `cloud.ts`, `googleDrive.ts` nor upload APIs. Test Library database untouched, no conversion-triggered requests, and storage failures reported separately from Library/cloud availability. |
| R3-C5 | Actual nested persistent folder identity | `WorkspaceFolder` is flat (`id,name,createdAt`); `buildOrganizedTree` produces flat custom folders. `buildTree` derives source folders from item paths; pruning drops empty source groups. | Add the minimum icon-specific canonical folder model with `id,parentId,name,createdAt`; preserve source relative paths as metadata. Project into existing `TreeNode`, never invent a second tree UI. | Do not flatten folder drops or force nested folders through the existing flat folder model. Stable folder IDs survive reload, moves and reconversion. Empty folders need an explicit policy; preserving directory entries is the safer interpretation when directory APIs expose them. |
| R3-C6 | Persistent Uncategorized destination | Current converter gives each batch transient `png-N` IDs; existing direct-image imports create a new archive for every batch | Reserve one deterministic icon-folder ID for Uncategorized in the new database, inserted idempotently during initial open/import. | Repeated loose drops use the same folder, including after reload. Never use folder display name as identity. A dropped user directory named Uncategorized must not silently replace or merge into the reserved folder. |
| R3-C7 | Directory-aware local input | App drop reads only `dataTransfer.files`; converter does likewise; `importImages` reads only `File.name` and rejects duplicate paths. No directory traversal implementation was found in inspected paths. | Add a bounded directory-input adapter distinct from archive ZIP/import logic. It emits `{file,relativePath,rootToken}` and directory descriptors; file pickers and directory pickers feed that same boundary. | Capture dropped entry/handle references synchronously before asynchronous traversal; drain directory-reader batches, enforce depth/count/byte bounds, handle partial read errors and preserve root identity. Plain-file fallback must disclose unavailable hierarchy rather than pretend to preserve it. |
| R3-C8 | Safe duplicate imports and names | `allocateSvgFilename` handles case/NFC collisions and unsafe flat names; `buildSvgZip` rejects duplicates and path separators | Reuse the actual output-name allocator and ZIP helper. Persist allocated names, distinct from original filename/path and record ID. Allocate folder labels among siblings using stable canonical comparison. | Separate dropped roots with identical display names must get distinct IDs and safe visible suffixes; no accidental overwrite. Repeated same-path files remain distinct records unless a reviewed deduplication policy is explicitly chosen. Keep flat ZIP exports unless hierarchy export becomes an explicit requirement. |
| R3-C9 | Automatic conversion after durable intake | `PngSvgWorkspace.processQueue` is serial and cancellable, using `convertPng`; result/progress callbacks check active job identity and status | Lift queue/state ownership into an icon-collection controller/hook. Keep `PngSvgWorkspace` as the canvas presenter. Commit source Blob and queued metadata before showing an item as saved or starting conversion. | File persistence is a short transaction; decode/worker/SVG verification occurs outside it. Metadata/result Blob save is another short atomic transaction. A quota failure must not create a successful-looking saved item with no source. |
| R3-C10 | Reload and interrupted-job recovery | Current queue state and object URLs exist only in React; beforeunload merely warns | Store durable status, desired mode and generation revision. On hydration, queued work resumes; abandoned processing is recoverable. Explicitly cancelled/error items remain actionable and do not unexpectedly restart. | Result commits compare a stored job/generation token and record existence. Removal, mode change or retry during conversion cannot be undone by stale completion. Cross-tab workers require an atomic claim/lease or equivalent guard, not only an in-memory lock. |
| R3-C11 | Keep memory bounded with a growing saved collection | Current converter retains every File, SVG string and both object URLs; `MAX_SESSION_FILES=100`, sources 100 MiB, output 128 MiB | New startup API returns metadata only. Fetch original/result blobs for active conversion, selected preview and bounded download batches. Revoke presentation URLs on selection/disposal. | Distinguish per-import admission bounds, in-memory bounds and durable collection quota. Do not load every saved source/result into React on reload. Decide/report collection limits explicitly; an old session limit is not automatically the durable library limit. |
| R3-C12 | Preserve validated preview and exact fidelity semantics | Converter preview source URL is created only after `progress.stage==='converting'`, following structure/native decode validation. `convertPng` verifies the actual generated SVG; `fidelityLabel` gates the zero-difference badge. | Reuse `png-svg.ts`, worker, browser conversion and comparison unchanged. Persist the same verified SVG artifact and metadata together. | Do not create image URLs for newly accepted but unvalidated raw bytes. Saved fidelity must include when/environment/version checked or be rechecked on reopening; do not imply a current-browser test from a stale saved badge. Native dimensions and RGBA comparison remain untouched. |
| R3-C13 | Same search/sort/favorites/navigation behavior | `filterTree`, `projectTree`, `getPageOrder`, `getAncestorIds`, `firstFolderPage`, `treeDateMetadata`; `ArchiveTree` uses canonical IDs and roving focus | Pure icon adapter returns compatible `TreeNode[]`, display `HtmlPage[]` and organization metadata. Feed the same existing filtering, sorting and navigation helpers. | Folder-star membership should include current descendants; direct item stars stay independent. Selection follows the same filtered order and folder opening picks its first matching file. Avoid calling existing DB folder/item mutators with icon adapter IDs. |
| R3-C14 | Shared tree labels remain truthful | `ArchiveTree` hard-codes HTML/Image nouns and derives leaf glyph from `page.kind`; kind also affects ARIA empty text | Add an optional presentation label/noun/glyph option with existing defaults; leave `ItemKind` and remote schema alone. | Icons should be announced as Icons, not HTML pages or images merely to satisfy a type. The same component retains prior HTML/Image behavior and existing component tests. |
| R3-C15 | Conversion controls in canvas toolbar | Current converter places mode selector in `.png-mode-controls` inside its own aside; preview settings, result panel and export controls already exist | Move mode/default controls and retry/reconvert actions into the existing main/canvas toolbar/presenter area, retaining native controls and compact tokens. | Define whether a mode change affects future imports or selected saved item; label it explicitly. Existing ready output must not silently change mode. No dedicated converter dropzone/sidebar is retained. |
| R3-C16 | Local persistence errors must be recoverable | Existing db transactions abort and propagate errors; App disables Library imports after its storage error | Apply transactional validation and clear per-operation errors in the separate icon owner; reuse app notice/status presentation, not Library's storage-error flag. | Block conversion until intake is committed. Keep already saved records after a failed new batch. IndexedDB denial/quota/closed connection must produce an actionable failure, not a fake success or a cloud fallback. |
| R3-C17 | Preserve source privacy and delivery identity | `PRIVACY.md`, package pretest/prebuild, existing Git media scanner; Worker build and existing private hosting identity | Procedural PNG fixtures only; ignored browser evidence. Root coordinates significant commits/pushes, final build and same Site deployment. | No originals, persisted collections, SVG/ZIP downloads or embedded base64 fixtures in Git or deployed source. Update docs that currently promise memory-only conversion, after actual durable behavior is tested. |
| R3-C18 | Decisive tests and real runtime evidence | Existing suites cover archive import, cloud frontend/worker, tree, folder favorites, order, grid, dimensions, metadata, PNG vectors/bytes and component behavior. Real browser harness already covers native raster output. | Extend relevant pure tests and the development-only browser harness; preserve existing suites. | Add nested-directory intake, duplicate folders/files, Uncategorized across reloads, durable save/reopen/export, interrupted resume, stale completion after delete/retry, quota atomicity, exact shared tree and no-network icon flows. A type/build pass does not prove IndexedDB or file-system drop behavior. |

## Minimal recommended module boundaries

The existing Library remains its own canonical domain. The Icons collection becomes a separate local domain, sharing presentation and conversion primitives. This creates a clear storage boundary without a cloud migration, and avoids rewriting existing archive/file records merely to reuse the tree renderer.

| Owner | Proposed files / responsibility | Explicit interface boundary |
| --- | --- | --- |
| Root integration coordinator | `src/App.tsx`, shared CSS and narrowly scoped `ArchiveTree.tsx` presentation props | Top-level tab, actual sidebar DOM, active tree projection, selection, keyboard, mobile drawer and toolbar slots. No second sidebar. |
| Local collection owner | New `src/icon-collection.ts` plus `src/icon-types.ts` if needed | IndexedDB schema, transactions, metadata/source/result access, folder mutations, stable names, revision checks and queue claims. No network dependencies. |
| Input owner, possibly same local collection implementer | New `src/icon-drop.ts` | Synchronous drop capture, asynchronous bounded directory traversal, picker-relative paths, canonical validation, import report. No storage side effects until the explicit intake call. |
| Canvas/controller owner | `src/components/PngSvgWorkspace.tsx`, converter CSS, optionally `src/useIconCollection.ts` | Durable collection snapshot/queue hook and canvas presentation; receives controlled selected ID and action callbacks. Reuse engine and output artifacts. |
| Test owner | Focused `tests/icon-*.test.ts` and dev-only browser harness additions | Pure path/tree/name tests; actual IndexedDB/reload/drop interactions; original fidelity fixture reuse. |

Do not share file ownership across simultaneous implementers. In particular, the root should retain App and the shared sidebar/tree API changes, while the storage owner exposes a stable typed API before canvas integration.

### Suggested durable model and API

These are architecture recommendations for planning, not claims that files or APIs exist.

`IconFolder` needs a durable ID, parent ID or null, display name, canonical sibling-name key and added timestamp. `IconRecord` needs a durable ID, folder ID, original source filename/path, allocated SVG filename, byte length, source modified timestamp, conversion mode, status, generation revision, error message and optional output/fidelity metadata. Original bytes and generated SVG bytes belong in dedicated Blob stores keyed by icon ID/revision; do not put Blob contents inside the normal metadata listing.

Suitable API shape:

```ts
listIconCollection(): Promise<IconCollectionSnapshot> // metadata and preferences only
importIconEntries(entries, mode): Promise<IconImportReport> // source+queued metadata atomic
getIconSource(id): Promise<Blob | undefined>
getIconOutput(id, revision): Promise<Blob | undefined>
claimNextIconJob(owner): Promise<IconJob | undefined>
completeIconJob(id, revision, claim, result): Promise<boolean>
failIconJob(id, revision, claim, error): Promise<boolean>
queueIconConversion(id, mode): Promise<IconRecord> // increments revision
cancelIconConversion(id): Promise<void>
removeIcon(id): Promise<void>
createIconFolder(name, parentId): Promise<IconFolder>
moveIcon(id, folderId): Promise<void>
setIconFavorite(id, favorite): Promise<void>
setIconFolderFavorite(id, favorite): Promise<void>
setIconPreferences(patch): Promise<void>
projectIconCollection(snapshot): IconTreeProjection // pure presentation adapter
```

The implementer may combine APIs while retaining their transaction and ownership invariants. Explicit IDs and revisions matter more than the spelling. For multiple tabs, make claim ownership durable and use a bounded lease/heartbeat or browser lock with a fallback; recovery must not seize another live tab's conversion. A collection-change broadcast or focus refresh keeps two visible tabs from displaying stale metadata, while all authoritative mutation checks remain in IndexedDB transactions.

The coordinator subsequently identified research for an optional smooth representation. The storage contract should therefore distinguish requested mode/intent from the actual output representation, and retain engine/version and any explicit fallback reason with the result. A reopened curve result must not be labeled pixel geometry or inherit a zero-difference claim from a different artifact. This assessment does not approve a tracing algorithm or change the existing exact comparator; that choice and its quality criteria belong to the research, architecture and revised plan.

The adapter may represent icon display items as `HtmlPage` with `kind:'image'` to reuse current generic sort/date helpers, but those records must never enter App's Library `items`, `saveImport`, `getFile`, image cloud cache or `ImageViewer`. For Icons, App derives active metadata/maps/organization from the icon snapshot and supplies the icon-specific callbacks. A typed `WorkspaceTab` is separate from `ItemKind`, so HTML/Image records, cloud validation and existing grids need no third persisted item kind.

Nested icon folders can become existing `TreeNode` groups with `kind:'collection'`, `folderId` set to the canonical icon folder ID, and child folders/items preserved. That allows `favoriteFolderId`, disclosure controls, virtualization and current month/all-file projection to operate. The pure adapter supplies inherited favorites and counts without copying the `ArchiveTree` UI. Preserve empty folders in folder grouping; month/all-file views naturally show only items.

## Alternatives and migration consequences

**Separate icon database (recommended):** no modification to `folio-workspace` version 3 or cloud schema; original Library records and rollback compatibility remain intact. Costs are a second connection and explicit active-collection adapters. Browser storage still shares the same origin quota, so isolation does not mean unlimited space.

**Add icon stores to Library version 4:** feasible as an additive upgrade, but expands the shared connection/upgrade surface and requires blocked-upgrade, older-tab and rollback evidence. It adds no immediate benefit because icon records must still be excluded from cloud sync and ordinary archive import. Do not choose it merely to reuse the private `database()` function.

**Extend `ItemKind` with icon and reuse archive stores:** broadens `Record<ItemKind,...>` state, validation and metadata consumers; increases the risk of conversion originals appearing in Images or going through cloud-aware accessors. Not recommended for this bounded revision.

There is no prior durable converter dataset to migrate: the released converter stores only React state and object URLs. A previously closed/reloaded tab's files cannot be recovered. Existing HTML/Image database contents must remain exactly as they are. In-session transient files could only be retained if an explicit live state handoff is implemented before unmount; do not claim recovery of already-lost memory. New docs should explain browser-local durability and that clearing site storage removes icons, without promising synchronization or universal browser retention.

## Behavior diagnosis and verification boundaries

The mismatch is confirmed by source: `App.tsx` conditionally hides the entire Library app shell for converter mode; `PngSvgWorkspace` renders its own aside/list and owns all inputs/results only in React state. Existing direct drops ignore entry hierarchy because they reduce to `File[]`. Thus the current output cannot satisfy one shared sidebar, durable icons or hierarchy preservation without moving ownership. This is a design-contract mismatch plus newly requested persistence, not evidence of a broken PNG vector engine.

No actual browser reproduction was performed in this assessment. The coordinator's current browser inspection and the retained prior browser artifact can supply that observation; the new diagnosis must identify its own current rendered evidence. Folder-drop API details require targeted primary-source research, especially browser fallbacks and reader batching. IndexedDB durability, multi-tab behavior, quota failures and real directory drops remain unverified until implementation tests.

Selected regression commands remain `npm test` (includes source privacy pretest), TypeScript no-emit check, and root-owned `npm run build`. The dev harness generator is `node --import tsx scripts/prepare-png-svg-check.mjs`. Existing 180 test/19 browser outcomes are prior-release evidence only, not revision-3 results. This assessment ran none of those commands.

## Source snapshot fingerprints

SHA-256 read at 2026-10-29T14:12:30Z:

| Source | SHA-256 |
| --- | --- |
| `src/App.tsx` | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| `src/types.ts` | `842ca42dfb8e8be835c79ec53d5e22ae4d06383a83cba34b029ee24f87a2ea75` |
| `src/db.ts` | `e1d19e823913b2913c7a7f48f47098066b9e6ea957c8168b933d06a2bd494770` |
| `src/tree.ts` | `bb34f30544ba1edaea7b471841edac430ba674e37dc32e94a405149b4d29d3fa` |
| `src/components/ArchiveTree.tsx` | `54a24f64fe3dc7a8923d6fb2a458a2d83685ebb4f073c37b0202c1230dcad14a` |
| `src/components/PngSvgWorkspace.tsx` | `459a8a751b723df1a30ef9476cbeacebdc61b7a73704677d2d189fb91b0e42cd` |
| `src/png-svg-browser.ts` | `f13182d83269a4ccdc98b77b6285e24e4814eed86950ee7ef1b5d0e786f265e2` |
| `src/styles.css` | `b27c4ad0a62abbde5a85b460faf0b185096d61582b3269ff6794128ccfc4f5a6` |

Read source boundaries: full App/types/db/tree/ArchiveTree and current converter; relevant archive path/import, order/grid, metadata/favorite helpers, package scripts, privacy policy and existing record request/plan/test plan/critique. No `AGENTS.md` was found by the checkout file inventory. No private collection source media or production database contents were opened.
