# Implementation plan — revision 2

## Requested deliverable and authority

Implement and publish PNG-to-SVG conversion inside the existing Folio repository and Site, from start to finish. S1 is the current user request in request.md and record.json. The later prose supersedes the quoted standalone-app instruction: this is an integrated local-processing workspace. One task record, real delegated agents, frequent committed/pushed checkpoints. Root is source integration and build/publication coordinator. No private collection data or downloaded/generated media enters Git.

## Verified baseline

GitHub main 2dc43cb0a91981514243b4ce5fed014ea0de59c0. Existing Sites source 05766c8d5511bcd7cf4b88f6cbf0a9a355c597db; relevant app/CSS/worker source equal. React 19.1.1 / TS 5.8.3 / Vite 6.3.5. JSZip 3.10.1 already installed. No routing or image conversion dependency needed. See C1–C13 in artifacts/assessment.md and primary-source research in artifacts/research.md. Live collection is private; dev preview has no production backend, so its collection unavailable notice is baseline behavior.

## Scope delta

Add a compact workspace switch and transient local PNG conversion feature (S1: build it into our current one, proper navigation). Preserve existing library selection, database v3, ItemKind html/image, global styles, cloud/read APIs, favorites, capture and all media privacy rules (C2/C5/C6/C12). Local converter files must never flow through saveImport, cloud.ts, Google Drive or worker/cloud.mjs. Existing library may continue its unrelated reads; converter causes no upload or remote content requests. Scoped hash navigation can retain deep links if introduced; a router package is unnecessary.

Native dimensions/transparency/AA are explicit. Browser RGBA8 reference is a native-size transparent sRGB canvas; no resizing, quantization, thresholding or compositing. Full alpha/255 precision; skip only alpha-zero shapes. Merge horizontal identical RGBA runs, extend identical x/width/RGBA spans across rows, never overlap geometry. Worker generation is serial and cancellable. Compare the actual downloadable SVG raster to source: count differences if alpha differs or any RGB differs while either alpha is nonzero. Ignore only invisible RGB where both alphas zero. Zero tolerance. Unsupported rendering yields unverified with explanation, never a passed badge. Original PNG bytes are retained for embedded mode.

Necessary bounds protect the requested local batch tool from unusable allocations: validate PNG signature/chunk bounds/IHDR before decode, cap input bytes, sides/pixels, output rectangles/bytes and aggregate session retention. Reject animation acTL and unsupported decode dimension changes rather than falsely verify a static transformed image. Suggested initial per-file caps: 20 MiB, 4096 per side, 4,194,304 pixels; vector complexity <=150,000 merged rectangles and 24 MiB output; batch <=100 items and 100 MiB source total, retained SVG output <=128 MiB. Expose actionable messages and explicit embedded retry; tune only if evidence warrants a safer bound. No silent resizing or mode switching.

## Ordered implementation and ownership

### P1 — record and review [R12,R13]

Capture exact request, assessment, research, UI specification, full catalogue selection, R/P/T mappings and independent critique. Commit/push assessment/plan checkpoint before application changes. Finalize planned then criticized metadata; enforce resolve_plan_record.py --execution --require-critique. Reviewer is independent of root planner. Record source-only documentation commits as harmless baseline drift.

### P2 — conversion engine [R2,R3,R4,R5,R7,R8,R9,R10,R11]

Owned by delegated engine implementer: src/png-svg.ts (pure metadata validation, merging, serialization, embedded bytes, comparator, output naming); src/png-svg.worker.ts (local worker generation); src/png-svg-browser.ts (decode, worker lifecycle, native SVG raster verification, progress/cancel), and optionally src/png-svg-download.ts for ZIP/download helper if needed. Export explicit typed contracts to UI owner; no DB/cloud imports. Preserve actual SVG string/blob used in verification and download. File/object URL/canvas/worker resources have explicit cleanup. Use current dependencies only. Engine unit tests owned by separate test implementer or engine owner as coordinated, no overlapping files.

### P3 — integrated UI [R1,R4,R5,R6,R7,R8,R9,R11]

Root owns src/App.tsx, src/components/PngSvgWorkspace.tsx, src/components/png-svg.css plus shared navigation style additions in styles.css if needed. Separate workspace mode; keep App collection state mounted and isolate hidden controls. New converter component state persists while switching; gate collection shortcuts/drops and close stale popovers/drawers on switches. Native selects, existing buttons/icons, compact queue, two previews and status. Batch sequential processing with cancellation; remove/clear revoke URLs and cancel affected work; output count and errors always reconcile. Source filename shown as React text; generated SVG contains no untrusted filename markup. ZIP uses allocated flat names and only ready results, visibly reports skipped failed/pending items.

### P4 — verification fixtures and tests [R1,R2,R3,R4,R5,R6,R7,R8,R9,R10,R11,R12]

Test implementer owns tests/png-svg.test.ts, tests/png-svg-components.test.ts as needed, tests/png-fixture-generator.ts or equivalent procedural generator. Real indexed PNG PLTE+tRNS, alpha sweep, AA edge, opaque, transparent, multicolor, corrupted/truncated/oversized/animated samples generated in code. Browser harness is development-only and excluded from production entry/build; run via supported browser UI. No standalone browser installations or bypasses. Independent actual raster tests, changed-visible-pixel negative test, safe-name ZIP roundtrip and privacy dependency/network check. Reviewers return findings only; implementation owners repair and rerun affected checks.

### P5 — final documentation and release [R8,R11,R12,R13,R14]

Root runs full existing tests/typecheck and production Worker build once source stabilizes. Run privacy index check before commits/transfers. README/PRIVACY document local converter, session data lifetime, measured limits and exact verification scope. Push frequent focused commits on feat/local-png-to-svg; integrate into main without rewriting others' history once verified. Reconcile remote HEAD before updates; GitHub API may serve as write path if terminal credentials absent. Mirror source to existing Sites checkout without private data; preserve .openai/hosting.json identity/R2 and current owner-private audience. Use Sites source helper, save/deploy and verify native deployment result. No claims of cross-browser/color-profile parity beyond actual tests.

## Non-goals

No smoothing/curve tracing, external conversion service, cloud upload, DB/schema migration, automatic persistence of converter inputs, collection reorganization, new Site, audience change, new design system, marketing page or unrelated cleanup. Generated fixture media/screenshot evidence are ephemeral and ignored. No new runtime dependency expected.

## Risks and decisive evidence

Alpha premultiplication may make some inputs report a nonzero count; truthfulness is mandatory, and prioritize exact matches without hiding discrepancies. Exhaustive generated-alpha cases guide numeric emission. Native canvas size limits differ, so limit/resource errors stay explicit. Browser automation can inspect preview but production sign-in may block collection QA; native deploy verifies publication separately. Final R/P/T status reflects actual tests and any missing browser coverage.

## Revision 2 — independent review F1

Strengthened T4 to require positive zero-difference raster results for all six standard fixture categories plus embedded partial-alpha, mapped to R3/R4. Honest deliberate-mismatch/error cases remain separate. No product scope change.
