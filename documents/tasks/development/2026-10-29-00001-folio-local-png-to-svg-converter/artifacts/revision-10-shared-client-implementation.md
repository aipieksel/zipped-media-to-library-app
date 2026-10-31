# Revision 10 — shared browser persistence implementation

Status: implementation, focused Node checks and independent reproduced shared-client findings pass. The coordinator also executed the isolated native browser runner successfully; its separate saved receipt remains the authoritative browser evidence.

## Scope and public contract

The shared adapter preserves existing Library and Icons operation APIs. The authenticated application root imports `src/shared/workspace.ts`, calls `configureSharedWorkspace({enabled:true})`, awaits `startSharedWorkspace()` before mounting the workspace, unmounts it before `stopSharedWorkspace()`, and subscribes to `{library?,icons?,appearance?,error?}` updates. Explicit development configuration `{enabled:false}` retains standalone device storage. A signed-out shared session is locked; it never silently falls through to legacy local databases.

The module also exports synchronous cached `getSharedAppearance()`, acknowledged `saveSharedAppearance(palette)`, explicit `refreshSharedWorkspace()`, read-only `inspectBrowserData()`, user-invoked `migrateBrowserData()`, and recovery list/retry/discard operations. `SharedWorkspaceSettings` takes no required props.

## Persistence and acknowledgements

- Original device stores `folio-workspace` and `folio-icons` remain intact. Separate `folio-workspace-shared-v1` and `folio-icons-shared-v1` databases cache authenticated shared state.
- Every material shared edit uses a serialized staged database copy. The server's compare-and-swap revision acknowledgement precedes installation into the live cache. A failed network request or stale revision leaves the live shared collection unchanged and retains the attempted input in a durable recovery journal. Explicit retry performs a three-way record comparison; it does not overwrite another client's changed version of the same record.
- At most twenty pending recovery changes are retained before further shared mutations pause. A no-op removes its journal and staging database. Device selection, view preferences, claims, heartbeats and AI pairing remain local. Disposable gallery thumbnails are excluded from staging copies.
- Existing curated cloud archives and original media are excluded from the shared overlay. Folder organization, item/folder favorites, hidden curated roots, imported HTML/images, icon sources/outputs, saved immutable bases/current colors and provenance are shared.
- Pending conversions are published as recoverable pending sources, without the importing browser's worker lease. Only the importing browser retains its queued/processing state. Completed output is acknowledged before publication; failed completed-output publication pauses the local job and retains the completed stage for explicit retry.

## Bounded metadata and exact bytes

The generic backend contract is unchanged: the root document PUT stays within 1 MiB and contains at most 10,000 unique published blob hashes; each immutable chunk is at most 8 MiB and is hash-verified. Small new files share chunk packs and retain validated offset/length slices. Large files use consecutive bounded chunks. Logical file references are bounded at 128 MiB.

Small dataset metadata stays inline. Larger metadata becomes an immutable JSON manifest, capped at 64 MiB, referenced by a bounded `{schema:1,kind,manifest}` root document. The root's hash set exactly covers both metadata and asset chunks. A single CAS publishes the complete index. Record validation permits cumulative collections beyond the existing 20,000-entry per-import limit, with 100,000 records per store as an additional allocation bound. Original filenames, IDs, MIME types, dimensions, folders and file bytes remain represented in the metadata.

Requested payloads are fetched lazily and verified before use. A 32 MiB in-memory chunk cache avoids repeatedly fetching a packed chunk for its different files. The cache and outstanding response bodies are cleared/aborted when the workspace stops. Every request uses same-origin cookies, no-store caching, redirect rejection and a 25-second total fetch/body timeout. The managed HTTP preview uses the existing secure-random ID fallback and pinned Noble SHA256 when SubtleCrypto is unavailable.

## Migration and remote artwork trust

Inventory reads metadata and Blob sizes without uploading data. Explicit migration copies records under their stable IDs, preserves original browser databases, records a digest ledger and skips identical retries. When a later import changes a pack layout, migration compares exact original file contents instead of treating an unchanged file as a conflict because its container hash changed. Migration captures the initiating session across local reads and both dataset publications.

Shared conversion and Saved SVG getters apply the existing SVG allow-list before preview/export. Embedded wrappers must exactly equal a wrapper reconstructed from the retained original image bytes. Shared vectors must already declare native width, height and viewBox; a sanitizer's ability to supply missing attributes does not qualify the original download bytes. Remote `verified` metadata is never treated as a fresh check in this browser. Displayed verification is local and bound to exact source/output descriptors and dimensions. Shared conversion output receives a native check when opened; Saved artwork uses its existing native-check flow with the served-byte identity checked again before a local stamp is accepted.

## Verification so far

`node --import tsx tests/shared-client.test.ts` passes 10 focused tests, including:

1. Two independent clients, chunk-boundary exact bytes and stale CAS rejection.
2. Packed slice boundaries/MIME, single verified pack reuse, malformed slices and corrupt hashes.
3. A real parsed 20,000-entry ZIP plus a subsequent import, proving 20,001 cumulative file records and metadata exceeding 1 MiB can round-trip while the atomic root request stays bounded.
4. Migration equality across repacking and rejection of actual changed bytes.
5. SHA256 fallback against the standard `abc` digest without SubtleCrypto.
6. Required UI metadata fields, curated/private-state filtering and local lease exclusion.
7. Explicit three-way independent edit recovery and same-record conflict rejection.
8. Concurrent same-name conversion and Saved additions allocate distinct safe SVG filenames, preserve latest server names, export real ZIPs, and remain idempotent after a lost recovery acknowledgement.
9. Script payload/forged embedded wrapper/missing native declaration rejection and verification identity changes.
10. Abort of an in-progress response body, locked shared placeholders and explicit standalone mode.

The existing `tests/icon-collection.test.ts` also passes all 9 cases after extracting its unchanged sibling allocator for shared recovery.

Scoped strict TypeScript passed for the shared modules, Library/Icon adapters, hook, Settings component and these test modules. This is not a claim of hosted-account end-to-end verification.

The browser fixture is generated by `node tests/shared-client-prepare.mjs` and runs on the existing managed development origin at `/tests/shared-client-runner.html`. Generated HTML remains ignored under the repository's existing privacy rules; the generator and test TypeScript are the reproducible deliverables. It uses native IndexedDB and SVG rendering with an explicitly synthetic in-memory server. The credentialless iframe uses the browser's ephemeral storage partition, refuses pre-existing Folio databases, and reports whether parent database names remain unchanged. This isolation behavior is documented by Chrome: https://developer.chrome.com/blog/iframe-credentialless and the specification: https://wicg.github.io/anonymous-iframe/.

The coordinator reported **8 of 8 native browser groups passing in Chrome 155**, completed at **2026-10-31T19:00:47.869Z**, on the exact managed origin. The result includes `isolatedPartition:true` and `parentDatabaseNamesUnchanged:true`. Passed groups cover read-only inventory; migration and idempotency; no-op and failed-publication recovery; independent CAS edits; device-owned queue, completed SVG retention/retry and native pixel checking; hidden curated roots; logout/session fences; and unchanged original browser inventory. This is actual native IndexedDB/rendering evidence with a synthetic transport, distinct from the coordinator's separate real backend/account and application UI journey.

## Independent finding closure at this checkpoint

The independent reviewer reproduced capacity, typed-metadata, SVG-trust, migration-repacking and concurrent-filename defects during implementation. Each has a focused fix and regression evidence. The collision repair reuses the existing sibling allocator through `shared/icon-names.ts`; it preserves latest published names and allocates safe distinct names to changed or incoming entries during explicit recovery/migration. A lost-response retry recognizes the already committed allocation without overwriting it or introducing additional suffixes. Shared dataset validation rejects unsafe or duplicate export filenames before hydration. Independent review hashes and its final verdict belong to the separate review artifact.
