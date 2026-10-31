# Folio AI integration — codebase and ownership assessment

Assessment date: 2026-10-31. Stage: GAS, read-only. Profiles: React frontend and media library.

## Baseline and scope

- Repository: `/workspace/scratch/6d5f921cc245/folio`.
- Inspected source HEAD: `ca95e01` (`Complete reviewed Icons workflow and WebP release record`). Initial worktree was clean. There is **no source drift from the prior completed revision ca95e01**.
- Existing workflow record: `documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter`, revision 7, complete before this request. This assessment creates no new task record.
- No `AGENTS.md` was found in the repository or checked ancestor locations.
- This assessment reads source/configuration/tests only. It does not run the app, install dependencies, execute tests, access accounts, inspect credentials, change Git, or verify the live Site's current access policy.
- Package source, provider capabilities, and official account-authentication feasibility are owned by parallel assessments. No provider/model claims here assume that the supplied package supports them.

The authorized extension is a shared AI capability with a first SVG recreation/cleanup action on the existing Icons page, user-selected persistent SVG results and recoloring, and compact global AI/settings/account surfaces. Existing PNG/WebP conversion, shared navigation, private collection ownership, and exact-fidelity semantics are retained.

## C-01 — Maintained application and deployment boundaries

The maintained frontend is React 19 + TypeScript 5.8 + Vite 6. Runtime dependencies include `idb`, `jszip`, `lucide-react`, `fit-curve`, `imagetracerjs`, and `vtracer-browser`. `package.json` contains no AI, password, session, OAuth, or account SDK dependency.

`worker/index.js` calls `handleCollection(request, env)` and otherwise serves built frontend assets embedded by `scripts/build-worker.mjs`. It rejects non-GET/HEAD requests outside collection routes. This is a Worker-style request runtime, not an existing Node application server. Any supplied package requiring child processes or a locally logged-in CLI needs a separately identified compatible runtime; it cannot simply be imported into browser components or assumed to run in this Worker.

`.openai/hosting.json` identifies the existing Sites project `appgprj_6adf889bceb8819185995cc72b70be04` and an R2 `BUCKET` binding. The read-only source review cannot establish a current Site account identity or platform login API.

Build/test ownership is already centralized:

- `npm run build`: capture helper build, TypeScript build, Vite build, Worker build.
- `npm test`: Node test runner over `tests/*.test.ts` using `tsx`.
- Both prebuild and pretest run repository privacy checks.
- `scripts/check-repository-privacy.mjs`, `.githooks`, and `tests/repository-privacy.test.mjs` enforce source-only repository content.

## C-02 — Canonical navigation and UI owners

| Behavior | Current canonical owner | Assessment consequence |
|---|---|---|
| HTML / Images / Icons tabs, hash navigation, selection | `src/App.tsx`: `WorkspaceTab`, `hashTab`, `switchTab`, `workspace-navigation` | Keep this one navigation surface. The three file-type tabs already occupy the requested top position. |
| One shared Finder-like sidebar | `App.tsx` + `components/ArchiveTree.tsx`; `projectIconCollection` adapts Icons metadata | Extend existing collection projection and callbacks rather than adding an AI or curated-icons sidebar. |
| Shared search, favorites, nested folders, sort, sidebar width, keyboard file cycling, mobile drawer | `App.tsx`, `ArchiveTree`, `tree.ts`, `order.ts`, sidebar helpers | New modes must maintain selected-item identity and existing keyboard/mobile behavior. |
| Import anywhere in sidebar/canvas | `App.tsx` app-shell drag/drop owner; `icon-drop.ts` for captured directory entries | Do not add a competing drop zone or upload path for AI. Automatic imports remain local conversion. |
| Icons controls and comparison canvas | `components/PngSvgWorkspace.tsx`, `components/png-svg.css` | Existing toolbar and selected-icon comparison are the direct insertion points for explicit AI actions, output review, save, and recolor. |
| Main selected-file download | `App.tsx`: `downloadSelected` and top toolbar button | Must resolve the exact currently selected saved/colored SVG variant, consistent with preview and ZIP. |
| Global dialog | Local `Modal` in `App.tsx` | Existing native dialog handles Escape, focus restoration, and click outside. Reuse/extract this owner rather than introducing another modal dependency. |
| Current settings | `App.tsx` `popover === 'settings'` | This is only **View and capture settings**, and it is hidden in Icons. It is not a global application settings or account page. |
| UI styling conventions | `src/styles.css`, existing `.button`, `.icon-button`, `.menu-row`, `.setting-row`, `.toolbar-popover`, `.modal` | The app already has compact components suitable for the requested clean menu and settings tabs. |

`App.tsx` currently owns an `anyModal` aggregate that suppresses keyboard file navigation. Any new settings/AI dialog needs inclusion in that authority, or equivalent centralized dialog state, so arrow keys and `/` do not operate on files behind an open form. Existing popovers already implement Escape and focus restoration.

`PngSvgWorkspace` explicitly describes itself as “Canvas only: App owns the one shared Library sidebar and all tree navigation.” Its controls currently include mode, zoom, background, stop, and ZIP. It displays a source PNG/WebP and one conversion output. It has no AI, prompt composer, model selector, result review, save selection, or recolor UI.

## C-03 — Existing Icons persistence is durable local conversion history, not a curated output library

`src/icon-collection.ts` owns IndexedDB `folio-icons`, currently version 1:

| Store | Stored identity/content |
|---|---|
| `icons` | `IconRecord` metadata, source identity, conversion mode/revision/status/result metadata, favorite, lease |
| `folders` | Stable folder identity, parent, name, created time, favorite |
| `sources` | Original Blob by icon id |
| `outputs` | One generated SVG Blob by icon id, guarded by conversion revision |
| `prefs` | Selected id, expanded folders, order, default mode, zoom, background |

`src/icon-types.ts` is the canonical type authority. `IconRecord` has a source id and one result; it has no approved-result flag, AI provenance, named variant, user color selection, or separate saved-library entity. Every imported icon is automatically persisted, including its source. The word “saved” in the current UI therefore means stored in this browser, not user-approved artwork.

Important invariants in `IconCollectionStore`:

- `importEntries` persists folders, source blobs, queued metadata, and selection atomically before conversion.
- `allocateIconName` and `allocateSvgFilename` provide separate safe sibling/output naming with NFC/case collision handling and reserved-name protection.
- `getSource(id)` confirms the icon still exists. `getOutput(id, revision)` requires a ready record and matching current output revision.
- `complete(claim, result)` uses a single transaction to write exact output bytes plus corresponding result metadata and validates the live conversion lease.
- **`retry` increments revision and deletes the previous SVG output.** Mode changes call retry. Therefore, approved AI/colored/library output must not be stored only in that replaceable converter slot.
- `remove` and recursive `removeFolder` currently delete source/output/metadata. Removing Uncategorized itself is forbidden.
- `write` awaits transaction completion before announcing updates; failures retain an actionable error.
- `BroadcastChannel` plus refresh handles cross-tab changes.
- `openIconCollection` v1 upgrade currently unconditionally creates the initial stores. Any schema increase must gate old-version creation and preserve existing records; it cannot rerun the v1 body unchanged.
- `projectIconCollection` creates presentation-only tree/page/folder adapters. These projections deliberately never enter Library archive/file persistence APIs.

`src/useIconCollection.ts` owns conversion lifecycle, not just a component: it is mounted at App root even when another tab is active. It uses one live worker across tabs, expiring leases, heartbeat renewal, stale-result checks, abort on deletion/retry/cancel, and resume after reload. It exposes metadata snapshots and lazy source/output reads. A remote AI request should have explicit action/result ownership, cancellation, and stale selection/revision checks, rather than being silently appended to the automatic local import pump.

Persistence semantics are browser/site-profile local. Clearing site data or browser eviction can remove this collection. Source contains no account-based icon backup or cloud synchronization. UI must not promise irrevocable/permanent or cross-device storage unless an actual separate backing service is implemented and verified.

## C-04 — Shared AI and future Images asset boundary

There is no current shared AI client, provider registry, AI settings store, job/request abstraction, or AI UI.

For Icons, obtain original source from `useIconCollection.getSource(id)` / store `getSource` and selected original converter output from `getOutput(id, revision)`. The source is preserved as PNG/WebP bytes and its format is validated during conversion. Do not use object URLs as durable identities.

For Images, the correct existing original-byte owner is **`src/db.ts` `getFile(id)`**:

- For local imports it returns the IndexedDB original Blob.
- For private collection items it obtains archive metadata and delegates to `src/cloud.ts` `resolveFileBlob` for the original resource.
- `src/download.ts` already uses this same function to preserve original image bytes in downloads.

`components/ImageViewer.tsx`, `image-cache.ts`, and `cloud.ts` use thumbnail/preview/original renditions with immutable metadata, lazy fetching, retained decoded images, bounded URL leases, and nearby-image prefetch. These are presentation/performance layers. AI must not accidentally receive a low-resolution placeholder or preview instead of the selected original. Reusable AI inputs should describe source ids, file type, original bytes, optional current SVG, task, provider/model, and cancellation separately from gallery presentation.

The initial shared service can be usable by an explicit selected-image action without redesigning ImageViewer. Reuse App's existing selected item and source loader. Future transformations should create a derived result identity and preserve the source. No existing contract permits automatic provider submission of the whole private collection, prefetch targets, or files merely because a preview was opened.

## C-05 — SVG safety, recoloring, and fidelity boundaries

`src/png-svg-browser.ts` exports two immediately reusable authorities:

- `decodeRasterPixels(file, signal)` obtains bounded decoded native pixels using the existing PNG/WebP input validation.
- `verifySvgPixels(svg, source, width, height, signal)` renders the **exact downloadable SVG string** at native dimensions and calls `compareVisiblePixels`.

`compareVisiblePixels` in `src/png-svg.ts` counts a differing pixel with no color tolerance and ignores hidden RGB only when both alpha values are zero. The result is verified only when differingPixels equals zero. The current UI also records browser, time, sRGB/RGBA8, dimensions, and unavailable reasons. This remains useful for AI-produced artwork, but smooth AI reconstruction must not inherit the previous pixel-vector result's check or be labeled universally exact. Recolor changes comparison semantics and requires fresh metadata or an explicit statement that the color-adjusted variant is not the source comparison.

`src/png-svg-trace.ts` `normalizeTracedSvg` is an existing strict safe-geometry parser/serializer. It rejects entities, invalid dimensions, unsupported root attributes, non-vector elements, unsafe attributes and paint references. It accepts only `<g>` and `<path>` with a tightly bounded attribute grammar, and it rejects nonzero stroke widths. It is tailored to local tracers; typical model SVGs containing circle/rect, real strokes, local gradients, or other valid geometry would fail. Reuse its strict validation principles and numeric path validator, but do not silently broaden its established local-tracer contract or assume it is a general AI sanitizer.

AI-returned SVG is untrusted data. Current previews use Blob URLs in `<img>` rather than raw injected SVG markup. A safe SVG result contract must be applied before persistence, export, rendering, or recoloring. It needs bounded output, native dimensions/viewBox consistency, allowed geometry, no script/foreignObject/events/external URLs, and truthful vector-versus-bitmap classification.

Recoloring should operate on validated vector paint data and preserve transparent/none fills, opacity, holes, and strokes as applicable. Global string replacement of color literals is not a sufficient SVG model. Embedded PNG/WebP results remain bitmap content and cannot become recolorable vector geometry merely by changing an SVG wrapper fill.

Download consistency spans **two current owners**: App's individual `downloadSelected` and `PngSvgWorkspace.exportZip`, which calls `buildSvgZip` in `src/png-svg-download.ts`. Both need to read the same saved/colored representation that the preview displays. Existing ZIP checks ensure unique safe filenames and exact bytes. Existing 128 MB aggregate ZIP limits and per-result bounds should remain meaningful when variants are added.

## C-06 — Account and authentication reality

There is **no app login, logout, password verification/change/reset, profile, account database, user session, or authentication middleware in the inspected app**. `src/identity.ts` only produces random UUIDs; its name must not be mistaken for account identity.

`worker/cloud.mjs` documents that Sites dispatch enforces the project's existing owner-private policy. Collection reads support GET/HEAD. Its administrative ingest paths require `x-folio-ingest-token` and a same-origin write check. That administrative token is for publishing private collection data, not a user session and not an OpenAI credential.

The authentication boundary is therefore external platform access plus any separately authenticated CLI/provider connection. A profile/password screen cannot truthfully present an invented browser-local password as controlling the current Site. Account UI must identify which account it actually manages, delegate to a supported platform/provider authority where available, and distinguish app access, provider account, and local AI connection. The parallel official-auth/package research is needed to establish implementable account features. No authenticated OpenAI call or user login has been tested by this assessment.

Parent research update received after the source assessment: Sites documentation confirms stable per-site identity headers (id, email, full name) and platform-owned top-level `/signin-with-chatgpt` and `/signout-with-chatgpt` links. This enables truthful reuse of platform login/account-managed password security. A proposed `/api/account` dispatcher belongs in `worker/index.js` before the generic method guard/asset fallback; it should expose only supported identity fields and must remain independent of the private collection administrative ingest token. This documentation finding was supplied by the parent, not independently authenticated by this read-only assessment.

UI wiring advice: place the global menu at the right of App's existing `workspace-navigation`, reuse its menu/modal styling and add dialog state to `anyModal`. A compact Convert/Saved selector can sit in the Icons toolbar, while App owns its selected view, selection, filtering, common download action, and the data projection fed to the existing `ArchiveTree`. Saved artwork needs distinct durable identities/output records so local conversion retry cannot overwrite it. Keep conversion/provider controls out of the sidebar.

## C-07 — Privacy and source publication exclusions

`PRIVACY.md` and repository checks exclude imported ZIPs, originals, HTML, images/renditions, screenshots, captures, collection catalogues, resource manifests, source-history bundles, credentials, and generated media from Git. Code-generated synthetic test fixtures are the existing convention. The privacy scanner checks staged blobs and rejects disguised binary/HTML/SVG payloads, media extensions, private directories, credentials, symlinks, and large source blobs.

Existing Icons privacy copy states conversion/files never upload. That remains correct for local modes, but the new explicit AI action needs accurate disclosure identifying the selected bytes sent through the chosen provider connection. Do not keep a blanket “files never upload” claim on an interface that now offers AI submission. This does not authorize unrelated automatic media uploads or private fixture publication.

AI credentials/session secrets should not be saved into general browser preference storage, bundled frontend config, Git, task documents, logs, or test reports. Current `getPreference`/`setPreference` in `db.ts` can store non-secret choices such as model/provider and UI preferences; they are not a secret store.

## C-08 — Existing verification evidence owners and affected tests

This assessment does not claim new tests passed. Existing test modules provide the following concrete regression boundaries:

| Test owner | Existing covered behavior / relevant extension risk |
|---|---|
| `tests/icon-collection.test.ts` | Safe names, import budgets, conflicting roots, claim ownership and expiry, nested projection, permanent empty Uncategorized, folder favorites, normalized preferences. |
| `tests/icon-collection-browser-check.ts` | Real-browser IDB transactions/leases and actual app import/reload using unique QA database names and synthetic fixtures. Natural owner for additive migration, save/variant persistence, reload, deletion/race tests. |
| `tests/icon-drop.test.ts` | Browser drop-directory intake and limits; preserve immediate capture and existing import behavior. |
| `tests/png-svg.test.ts` | All required procedural PNG format classes; exact geometry; alpha comparison; dimensions; safe output names; exact ZIP bytes. |
| `tests/png-svg-browser-check.ts` | Actual browser native-size conversion and SVG comparison. |
| `tests/png-svg-trace.test.ts`, `png-svg-contours.test.ts`, `png-svg-curve-metrics.test.ts` | Existing approximate-tracer and fitted-curve behavior. Avoid broadening sanitizer in ways that weaken these. |
| `tests/webp-input.test.ts`, `webp-browser-check.ts`, `webp-encoded.check.ts` | VP8/VP8L/static format validation, alpha, profiles, exact embedded original MIME/bytes, mixed-name collisions, PNG regression, and animation rejection. |
| `tests/tree-components.test.ts`, `tree-folder-favorites.test.ts`, `grid-components.test.ts` | Existing common sidebar/gallery/navigation contracts. |
| `tests/image-speed.test.ts`, `image-dimensions.test.ts` | Original/rendition identity and performance behavior; an AI action must not trigger eager downloads of unrelated originals. |
| `tests/cloud-worker.test.ts`, `cloud-frontend.test.ts` | Private collection validation, administration guard, lazy original bytes, catalogue safety, and resource linkage. |
| `tests/repository-privacy.test.mjs` | Publication exclusions including forced-added files and disguised data. |

Meaningful new behavior needing dedicated evidence includes malicious/malformed model SVG rejection; exact source/prompt composition and provider capability gating; request timeout/cancel/stale-selection handling; migration from existing folio-icons v1 data; approved result retained across retry/reload; recolored preview/individual/ZIP bytes equality; account UI truthfulness; remote-send boundary; and settings/modal keyboard/mobile behavior. A mock AI response proves app integration, not actual account authentication or provider SVG quality; live authenticated evidence must be recorded separately.

## Affected maintained paths and constraints summary

Direct existing owners likely touched: `src/App.tsx`, `src/styles.css`, `src/components/PngSvgWorkspace.tsx`, `src/components/png-svg.css`, `src/icon-types.ts`, `src/icon-collection.ts`, `src/useIconCollection.ts`, `src/png-svg-download.ts`, relevant tests, `package.json`, privacy/help documentation. Shared AI settings/service, AI SVG validation, curated variant data, and a local runtime/bridge if required by the supplied package are currently absent and need explicit owners rather than duplicate ad hoc state inside Icons.

Conditional boundaries: `ImageViewer` only if adding the initial selected-image action there; `worker/index.js`/`worker/cloud.mjs` only if a proven compatible server endpoint is required; existing `db.ts` source reads can be reused without replacing library storage. The private collection, existing Site privacy policy, browser-stored originals, and local PNG/WebP queue should not be migrated into the new AI mechanism just to expose the feature.

The largest discovered gaps are concrete: account management does not yet exist; local CLI runtime and browser/Site runtime are distinct; existing latest-conversion persistence is not a curated variant library; and tracer SVG validation is too specialized to accept general model output without a separate bounded contract. These are implementation prerequisites, not reasons to redesign the current UI or weaken exact local conversion.
