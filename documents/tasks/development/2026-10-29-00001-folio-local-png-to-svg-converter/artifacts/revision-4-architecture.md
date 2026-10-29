# Revision 4 — architecture advisory (GAA)

**Outcome:** the current revision-4 plan adopts the smallest credible architecture for the revised feature. Accept the separate icon database and shared presentation boundary, subject to the plan's independent GPR admission and actual transaction/browser evidence. This is architecture advice, not an independent review of my earlier assessment or execution approval.

**Inputs read:** full `agents/architect/agent.md`, `specialists/database.md`, `specialists/editor-schema.md`, shared specialist contract and GAA handler from the installed c25 AI Development Workflow 3.0.0 package; `artifacts/revision-3-assessment.md`; current revision-4 `fix-plan.md`, `test-plan.md` and record requirements/steps. Application source matches the assessed `b66763e4be353bb17827e7da27b4ebf9783e15b5` baseline; the coordinator has checkpointed intervening documentation. No application, database, test, package or Git mutation was performed.

## Accepted ownership and contracts

| Existing owner | Accepted revision-4 boundary |
| --- | --- |
| `App.tsx`: active state, preferences, the existing sidebar, keyboard/mobile behavior | Root keeps one actual sidebar and `ArchiveTree`. HTML/Images/Icons are presentation tabs. Preserve the existing HTML/Image item union, Library preferences and `folio-workspace` v3 database. |
| `tree.ts`, `order.ts`, `metadata.ts`, `ArchiveTree.tsx`: tree projection, ordering, dates and rendering | Icon metadata adapts to existing `TreeNode` and display-item shapes. Reuse filtering, ordering, folder opening and navigation. Add only explicit Icons presentation labels; no duplicated tree UI and no icon adapter IDs passed to Library DB/cloud accessors. |
| New `icon-collection.ts`: canonical durable Icons data | Separate `folio-icons` database, metadata/folders/preferences and distinct original/result Blob stores. Nested folders have stable IDs and parent IDs; Uncategorized has one reserved ID. Short atomic intake commits source plus queued metadata; result commit preserves output Blob and its metadata together. |
| New `icon-drop.ts` and `useIconCollection.ts`: intake and lifecycle | Capture directory entries synchronously, traverse with bounded total entries/depth/accepted bytes, preserve root identity and report skipped/error entries. Controller hydrates metadata, fetches only active/selected/export blobs and owns serial conversion plus resource cleanup. Root owns canvas presentation. |
| Existing `png-svg-*` engine and separately owned tracer additions | Conversion receives saved original bytes and explicit mode; produces the actual artifact later previewed/downloaded. Persist requested mode, actual representation and engine identity. Exact comparator behavior is unchanged for every mode. |

Storage/controller API should express `list`, atomic `import`, lazy `getSource/getOutput`, `claim/heartbeat`, revision-checked `complete/fail`, `queue/cancel/remove`, folder/favorite/move mutations and preference updates. The pure tree adapter is derived state, never a second durable model. Durable records carry source identity/path, allocated SVG filename, desired mode, current revision/status and result/provenance metadata. Source timestamps and added timestamps retain distinct meanings.

## Concurrency and provenance obligations

A job claim must be acquired in a readwrite transaction and include owner, opaque claim token, revision and expiry. A live claim is not reset when another tab opens. Heartbeats renew only the still-current claim; recovery may claim queued or expired work. Completion/failure requires the record to exist and both revision and claim token to match; cancel/delete/retry invalidate that authority. Broadcast/focus refresh updates visible metadata, while IndexedDB remains authoritative. Revision-4 T2 now requires two real owners/connections, live and expired claims, old-owner rejection, and transaction-abort evidence; these are sufficient architectural gates when actually executed.

Persist check time, browser context, engine/version, actual mode and native dimensions with fidelity result and output. After reopening, the UI explicitly describes the saved native check rather than a fresh test. Smooth results retain actual native differing-pixel counts and approximation identity; a fallback cannot inherit the previous representation's badge. Successful engine execution is distinct from successful durable save. Intake abort leaves no partial folder/record/source import; output abort leaves recoverable state and no false ready badge.

## Alternatives, rollback and limits

A new shared-database version would introduce upgrade blocking and older-tab/rollback obligations without removing the need for icon isolation. Extending `ItemKind` and archive stores would broaden cloud validation and risk icons appearing in Images. The separate database avoids those changes at the cost of one additional connection and an explicit adapter.

Rolling back app source leaves the existing Library schema readable and the new Icons database untouched. Old code cannot browse the new Icons database; do not delete it during rollback or pretend to migrate already-lost transient converter memory. Future icon schema changes need additive versioning and defined unknown-version handling. Keep the user's current old-version tab open as required by the release plan.

Both databases still share origin storage quota. Durability survives navigation/reload, not browser storage clearing or eviction guarantees. Per-import admission, per-file conversion and bounded export limits remain distinct from total persisted collection size. File-only directory pickers cannot report empty directories; drag-entry paths can preserve them when exposed. No universal cross-browser, profile or smooth-recovery guarantee follows from the architecture. No runtime tests or production database inspection were performed here.

**Consumed input hashes:** assessment `8bc43d5211244b9a4f3640eb2df98008cd6ed86182983bb64476bfa34d861428`; revision-4 plan `6b9cacc1007c26d7315bc2e616f7e68efd026b07f6af29e0345df3d8cd0292e2`; test plan `bb721f23d9c4d02d218aab9f3a6d4af1c1e52d7501e10bfd12680b7e7c28f1b5`.

## Coordinator implementation decision after the actual contour gate

This dated addendum records root's implementation decision, separate from the advisory above. Chrome 155's first 28-check engine run rejected the VTracer silhouette candidate against the unchanged independent analytic 4× reference: alpha MAE 3.00750732421875 versus pixel geometry 2.7148980034722223. ImageTracer's tested silhouette result achieved 1.7295464409722223, retained two components, one hole and the thin stroke, and produced two paths instead of pixel cells. This is approximately 36.3% lower alpha error for that procedural fixture, not a general accuracy guarantee.

The chosen route therefore uses ImageTracer directly for the conservative single-foreground antialiased silhouette classification. The VTracer binary-silhouette branch was removed. Fully opaque artwork retains the raw-color VTracer path and tested local ImageTracer fallback; arbitrary RGBA artwork uses the bounded alpha-aware ImageTracer path. Engine metadata names the actual selected route. No downloaded artifact, native comparator, threshold or independent test target was changed to make the candidate pass. Follow-up browser and final built-asset execution remain separate gates in the execution record.
