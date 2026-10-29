# Revision 3 — independent plan review

**Verdict: blocked pending bounded plan corrections (REVISE).** Three material findings concern decisive acceptance, not missing user authorization. No implementation may be admitted on this review until the parent resolves F4–F6 and obtains focused readback. F7 is an implementation reminder, not an additional product feature or permission gate.

## Review receipt

This is local review evidence, not a native host-queue completion receipt.

| Field | Value |
| --- | --- |
| Schema | `plan-review-evidence/v1` |
| Run ID | `revision-3-gpr-20261029T142156Z` |
| Stage | `GPR / stage:review-plan` |
| Reviewed plan revision | `3` |
| Planner | `/root` |
| Author/reviewer | `/root/converter_engine` |
| Created at | `2026-10-29T14:21:56Z` |
| Source baseline / repoHead | `b66763e4be353bb17827e7da27b4ebf9783e15b5` (recorded baseline; relevant source fingerprints independently matched) |
| Input hash: fix-plan.md | `76b4c938a1ead3bc5a209cad8774105320a92586c0b0853f477ca2d953549b51` |
| Status | `blocked` |
| Evidence paths | `critique.md`, `artifacts/revision-3-assessment.md`, `artifacts/revision-3-fidelity-diagnosis.md`, `artifacts/revision-3-research.md` |

The reviewer did not author revision-3 requirements, steps, mappings or plan. This actor previously authored the exact converter and a fidelity diagnosis; that fact is disclosed rather than representing this as an independent certification of the old implementation. The current review is independent from the revision-3 planner and concerns the proposed changes and acceptance gates.

Read the canonical GPR handler, criticizer and record contract, and the available complete `agents-pro-v2/agents/plan-reviewer/agent.md` profile. The legacy `agents/plan-reviewer/agent.md` resource was unavailable through the skill reader; the available equivalent scoped reviewer profile was used. No workflow scripts or finalizers were run by this reviewer; root owns record admission.

## Authorized outcome and scope reconciliation

Read S1 and the full appended S2 in `record.json`, all six current record files, the prior critique snapshot, the revised assessment/diagnosis and the completed research artifact. Source inspection confirmed App currently owns the Library sidebar and ArchiveTree, and Library `ItemKind` remains `html | image`; the existing converter owns a separate transient sidebar. Relevant source SHA-256 values match the assessment snapshot below.

| User commitment or retained constraint | Plan coverage | Review disposition |
| --- | --- | --- |
| S2: “exact same sidebar as the library” and same tree/Finder controls | R1/R16/R23; P2/P4; T2/T3 | Covered by one actual sidebar/ArchiveTree driven by an icon adapter. A visually similar second sidebar would fail T3. |
| S2 self-correction: move HTML/Images where Library is and add Icons | R15; P4; T3 | Correctly follows the latest self-correction, removes old sidebar tabs and preserves Library preferences. |
| S2: conversion controls in a toolbar, no separate converter drop zone | R16; P4; T3 | Covered without redesigning existing HTML/Image controls. |
| S2: accept canvas/sidebar drops, create folders, loose PNGs in permanent Uncategorized | R17–R19; P2/P4; T2 | Canonical nested folders plus one reserved Uncategorized are a feasible necessary adaptation; current Library custom folders are flat. No Library schema expansion is needed. Empty-directory fallback scope needs the F7 qualification. |
| S2: convert immediately after dropping and retain the collection | R19/R20; P2/P4; T2/T4/T6 | Durable intake before automatic conversion is appropriate. Isolation from cloud is preserved. New multi-tab/quota/provenance obligations need the F5 assertions. |
| S2: deep current research and implemented fidelity improvement | R21/R22; P1/P3/P5; T5 | Research is substantive and source-grounded. Optional curves are a legitimate implementation choice while retaining S1's explicit pixel default. Improvement acceptance currently has the F4 escape clause. |
| S1: native dimensions/transparency, exact pixel default, original-byte embedded option, true zero-only check | R2–R4/R9/R10/R11; P3; T1/T5 | Preserved. Native comparison cannot be replaced with a tolerance or aesthetic score. Approximation and exactness remain different claims. |
| S1/S2: local privacy, source-only repository, frequent checkpoints, existing app integration | R8/R12–R14/R23; P1/P5/P6; T6/T7 | Covered. No new site, audience, cloud writes, telemetry or user-media commit is introduced. |

The isolated IndexedDB database, local blob stores and durable job claims are internal necessities for the user's persistent Icons collection. Keeping runtime/source data separate from the existing cloud-aware Library is a narrower change than adding a third persisted Library item kind. Moving controls and sharing the actual tree are authorized corrections, not optional redesign. Existing HTML/Image data and APIs remain explicitly excluded from migration.

## Material findings

### F4 — high — the smooth-quality gate can pass without improvement

**Evidence:** T5 currently ends its expected result with “chosen tracer proven better on relevant synthetic contour than pixel geometry at4x, otherwise retain an honest measured option and report limitation.” The same sentence appears in `record.json.checks[T5].expected`. The newly added silhouette path in `fix-plan.md` requires measurement but does not remove this alternative success condition.

**Impact:** The app could add a labeled smooth option, worsen all relevant contours, and still call R22 completed. That under-delivers the actual S2 correction. Research explicitly states that preserving an alpha palette can still create bumpy bands and requires a useful silhouette benchmark before adoption.

**Smallest correction:** Remove the no-improvement success alternative. Bind adoption to a generated 96px antialiased silhouette with a curved hole and thin/small details, a separately generated 4× ground-truth render, a defined quantitative improvement criterion, and preserved holes/components/strokes. Preserve the actual native RGBA difference count. If a candidate fails, revise/replace it; retain exact modes, but do not claim the failed smooth outcome complete. The optional silhouette classifier must reject arbitrary translucent fields/shadows and only apply to the reviewed narrowly eligible foreground class.

**Affected:** R21/R22; P3/P5; T5. **Disposition:** unresolved.

### F5 — medium — durable-state failure tests are not decisive

**Evidence:** The latest architecture paragraph adds a durable atomic lease/heartbeat, cross-tab refresh and saved fidelity provenance. T2 names transaction/revision contracts and reload/removal; T6 broadly names quota/failure review. Neither requires a live-claim second-tab case, expiry/reclaim/old-completion case or forced transaction failure. The assessment explicitly identifies these as transaction/ownership invariants, not merely UI details.

**Impact:** A single-tab demonstration can pass while a second tab steals a processing job, a stale claim writes a newer artifact, or a storage failure produces inconsistent saved state. The new persistence promise makes those failures materially different from the old transient converter.

**Smallest correction:** Add explicit T2/T4/T6 assertions for second-tab non-stealing, lease expiry/reclaim rejecting the old claim, stale delete/retry/cancel completion rejection, and forced source/result transaction abort with prior committed data intact and no false saved success. Reopen a stored result and verify its bytes and historical browser/time/engine label. Actual browser IndexedDB evidence is appropriate; no new production fault-injection API is required.

**Affected:** R5/R19/R20/R23; P2/P5; T2/T4/T6. **Disposition:** unresolved.

### F6 — medium — production worker/WASM loading is not an explicit executable gate

**Evidence:** The inspected package described in `artifacts/revision-3-research.md` ships entry JavaScript, a relative module worker and relative WASM. The research states `optimizeDeps.exclude` only addresses development and calls for production URL verification. T5 currently asks for bounded browser comparisons without identifying the built environment; T6 asks for a production build, while T7 allows a general UI smoke.

**Impact:** The development server can trace successfully while the published asset graph fails to locate its worker/WASM. A successful TypeScript/Vite build does not execute those runtime URLs. A fallback can also conceal that the advertised chosen engine never ran.

**Smallest correction:** Before retaining VTracer, perform a real opaque smooth conversion from the final production artifact/asset layout and record actual engine identity, successful worker/WASM loading and valid output. Exercise the shipped alpha route too. Verify bundled same-origin assets and no file/filename uploads or CDN dependency. If VTracer fails, remove it and ship only the proven route that also satisfies F4; do not keep an unused broken engine or claim a fallback exercised it.

**Affected:** R8/R14/R21/R22; P3/P5/P6; T5/T6/T7. **Disposition:** unresolved.

## Nonblocking implementation reminder

**F7:** Per-import 100 PNG/100 MiB admission does not by itself bound arbitrary empty/non-PNG directory traversal. P2 should cap traversed entries, depth and directory count, and report partial-read/unsupported-hierarchy outcomes. Empty folders can be preserved when directory-entry APIs expose them; file-only relative-path input cannot reveal directories containing no files. This is a bounded resource/fallback detail within the admitted import feature, not an extra feature or reason to seek user approval.

## Resolved during the draft review

The parent clarified the following before this exact snapshot was reviewed: per-import limits are not a 100-item lifetime collection limit; ZIP memory is bounded separately; active jobs have durable lease/heartbeat ownership; another tab must not reset a live job; and saved fidelity is labeled with its historical runtime/time/engine. Those are now adequate architecture directions. F5 asks for decisive proof rather than another redesign of those contracts.

Module ownership is disjoint and viable. Root owns App/UI/package/build/Git, the collection actor owns storage/drop/controller, and the engine actor owns tracing and its focused tests. Before parallel execution the owners should agree the shared mode/result type and actual-representation/provenance fields, as already required by the assessment. No additional architecture blocker was found.

## Exact evidence fingerprints

| Reviewed file | SHA-256 |
| --- | --- |
| `fix-plan.md` | `76b4c938a1ead3bc5a209cad8774105320a92586c0b0853f477ca2d953549b51` |
| `test-plan.md` | `b339933e30d01b765af1cd6a5d30e3a5a523235f2a4ee98f2f291d9d0374f564` |
| `checklist.md` | `8244a8d0aed555e887963f083291ebaacc7a97159dacb27371729fe18eeb09a6` |
| `record.json` | `541f1f77f2879411b852339b7f77bb56f2bec59f5049adba3942a4b9f43b5ea8` |
| Preserved revision-2 `critique.md` | `c97c7c231a6ad489350ce4b91927370330e0986c69bfd2d77e973223ce7edfc2` |
| `src/App.tsx` | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| `src/tree.ts` | `bb34f30544ba1edaea7b471841edac430ba674e37dc32e94a405149b4d29d3fa` |
| `src/types.ts` | `842ca42dfb8e8be835c79ec53d5e22ae4d06383a83cba34b029ee24f87a2ea75` |
| `src/db.ts` | `e1d19e823913b2913c7a7f48f47098066b9e6ea957c8168b933d06a2bd494770` |
| `src/components/ArchiveTree.tsx` | `54a24f64fe3dc7a8923d6fb2a458a2d83685ebb4f073c37b0202c1230dcad14a` |

The original critique text remains in place above the new review, and the prior snapshot was already present and unchanged. No application source, tests, dependencies, requirement mappings, plan/checklist text, build outputs or Git state were modified by this review. No runtime, test, build, browser, publication or execution-gate pass is claimed. Root should amend the plan/test mappings, advance the revision as required for material corrections, then request focused readback of F4–F6 before finalizing criticized readiness.

## Revision 4 — focused readback and current approval

**Current verdict: revised / approved for execution of plan revision 4.** Reviewer `/root/converter_engine` completed readback at `2026-10-29T14:40:14Z`. The parent authored the corrections and incremented the plan; this reviewer changed no plan/checklist/metadata mapping. Root still owns criticized finalization and the execution admission tool. This approval establishes a suitable plan, not implementation success.

Read current `fix-plan.md`, `test-plan.md`, `checklist.md`, the relevant `record.json` metadata and complete T1–T7 mappings. The behavioral scope remains the S1/S2 scope already reconciled above. Existing native-mode requirements R2–R4 retain their historical check marks with explicit new regression obligations; all affected revision outcomes remain open. No further product scope or user approval is introduced by these corrections.

| Finding | Actual correction verified | Current disposition |
| --- | --- | --- |
| F4 | T5 requires improvement against an independent 4× oracle for the 96px antialiased silhouette/curved hole/thin detail, retains holes/topology/details, rejects failed candidates, and includes negative classifier cases for multicolor, soft alpha fields and arbitrary translucent interiors. The former no-improvement acceptance alternative is absent from both Markdown and the record mapping. | `fixed_in_plan` |
| F5 | T2 explicitly tests two connection/tab owners, live-claim non-stealing, lease expiry/recovery with rejection of the former owner, cancel/delete/retry claim invalidation, source/result transaction-abort atomicity and historical verification labels. T4 keeps saved artifact/preview/download byte identity. | `fixed_in_plan` |
| F6 | T6 requires a real smooth conversion using the final production asset layout for every retained engine, recording engine identity and bundled worker/WASM loading. Dev-only evidence cannot pass that gate. | `fixed_in_plan` |
| F7 | The revision-4 correction section requires total discovered-entry/depth bounds and qualifies empty-directory reporting when only file relative paths are available. | Incorporated implementation obligation |

The accepted silhouette experiment remains approximate and bounded. Its metric and fixture measurements must be recorded before adoption; this plan approval does not pre-approve a guessed threshold, an alpha-losing output or a tracer that fails the positive quality gate. The default pixel and original-byte embedded contracts remain intact.

### Exact revision-4 fingerprints

| Reviewed file | SHA-256 |
| --- | --- |
| `fix-plan.md` / current input hash | `6b9cacc1007c26d7315bc2e616f7e68efd026b07f6af29e0345df3d8cd0292e2` |
| `test-plan.md` | `bb721f23d9c4d02d218aab9f3a6d4af1c1e52d7501e10bfd12680b7e7c28f1b5` |
| `checklist.md` | `7d2dc27b4f15a7307b19418a9555496e0b89157a7b99a07e3fb8b5896e92860c` |
| `record.json` before parent finalization | `05cab306af7614d086d0246aed02ebc2a040eaf02b855c80ecb6f7cc4fac0adf` |
| Preserved revision-2 critique | `c97c7c231a6ad489350ce4b91927370330e0986c69bfd2d77e973223ce7edfc2` |
| `src/App.tsx` | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| `src/tree.ts` | `bb34f30544ba1edaea7b471841edac430ba674e37dc32e94a405149b4d29d3fa` |
| `src/types.ts` | `842ca42dfb8e8be835c79ec53d5e22ae4d06383a83cba34b029ee24f87a2ea75` |
| `src/db.ts` | `e1d19e823913b2913c7a7f48f47098066b9e6ea957c8168b933d06a2bd494770` |
| `src/components/ArchiveTree.tsx` | `54a24f64fe3dc7a8923d6fb2a458a2d83685ebb4f073c37b0202c1230dcad14a` |
| `src/components/PngSvgWorkspace.tsx` | `459a8a751b723df1a30ef9476cbeacebdc61b7a73704677d2d189fb91b0e42cd` |
| `src/components/png-svg.css` | `4b77b724cf76b1408fbea85a7b7b67690060bfc2bf7371444f6b10aaf47c44f5` |
| `src/png-svg.ts` | `e406285f9a947e8b9dec6a78d92b3a0c38d22d363404ad95311f7e87d2d45f3c` |
| `src/png-svg-browser.ts` | `f13182d83269a4ccdc98b77b6285e24e4814eed86950ee7ef1b5d0e786f265e2` |
| `src/png-svg.worker.ts` | `dfcc0a77887594ed42894504720e0ba4cc4f5ad1f99eaf9fa0a1d50e5e2ebbfc` |

These application fingerprints match the prior assessment/review baseline. The coordinator reports a source-record checkpoint pushed as `f0f67c7`; this reviewer did not run Git or independently verify the remote checkpoint. No application edits or runtime checks were performed during readback. No open material plan findings remain; the earlier revision-3 blocked verdict is historical for the older plan.
