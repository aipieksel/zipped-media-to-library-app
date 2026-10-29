# Independent plan review — revision 1

Reviewer: `/root/fidelity_research`, operating as GPR independently from planner `/root`.
Date: 2026-10-29. Baseline inspected: `2dc43cb0a91981514243b4ce5fed014ea0de59c0`.
Verdict: **revised** — one bounded acceptance-contract correction is required before readiness. No application changes were made and no implementation permission is requested.

## Review scope and evidence

Read request.md, record.json, fix-plan.md, test-plan.md, checklist.md, assessment.md, design-spec.md and research.md. Inspected maintained integration points in src/App.tsx, src/main.tsx, src/styles.css, package.json, TypeScript/Vite configuration, .gitignore and PRIVACY.md. Confirmed App owns collection state and global handlers; new converter mode must remain outside ItemKind, saveImport and persisted collection schemas. Checked the original user brief against R1–R14 and P1–P5/T1–T9.

The plan correctly supersedes the quoted standalone instruction with the later integrated-app instruction. No curve tracing, cloud upload, database migration, new design system or site-audience change is introduced. Same-site publication is consistent with the supplied Site and end-to-end request. Transient converter state, serial processing, budgets and explicit cancellation/error states are reasonable implementation details for the local batch requirement. Frequent remote checkpoints are explicit user authority. Generated synthetic fixtures and ignored QA artifacts respect the repository's source-only policy.

## Findings

### F1 — medium — positive fidelity acceptance is under-specified

Evidence: test-plan.md T4 currently expects only a zero badge after an actual zero difference, with all nonzero/unsupported cases accurately labeled. This can pass even if every positive standard PNG fixture yields mismatches. The original request also prioritizes an exact native-size visual match; honest counting alone does not establish that positive outcome. T4 omits R3/R4 in its requirement mapping and does not explicitly call for an actual embedded-mode render check.

Minimal correction: require zero visible differences for the representative opaque, fully transparent, partial-alpha, antialiased, real indexed PLTE+tRNS and multicolor standard PNG fixtures in the recorded browser. Add an actual native-size embedded-mode verification using a nontrivial partial-alpha fixture, in addition to T2's original-byte assertion. Treat deliberate altered-pixel tests and genuine unsupported/color-profile cases separately. Map T4 to R3 and R4 as well as its existing R9/R10/R11. Do not introduce tolerance to make these tests pass.

Disposition: open pending the planner's bounded plan/test metadata correction and focused readback. No source redesign required.

### F2 — advisory — cancellation must suppress stale async completions

Evidence: P2/P3 already require worker cleanup, cancellation/removal and no stale completed results. These obligations need a job/attempt identity or abort checks at decode, worker return and SVG render boundaries; worker termination alone does not stop a pending image decode from publishing a result later. Preserve the already planned T3 cancellation test across these boundaries.

Disposition: covered by the accepted plan; implementation note, no revision or extra approval required.

### F3 — advisory — native verification and presentation must remain independent

Evidence: plan and design spec correctly distinguish CSS preview zoom from native-size rendering. Keep canvas bitmap dimensions at IHDR dimensions without devicePixelRatio multiplication; never compare checkerboard/background-composited screenshots. Root App's global drop and keyboard handlers at lines 267–276 and 441–446 need explicit workspace gating. Keeping state mounted alone does not disable hidden handlers or focus targets.

Disposition: covered by P2/P3 and T5/T6; verify affected browser journeys, no additional feature scope.

## Strengths retained

- Source reference explicitly uses browser-decoded sRGB RGBA8, and exact channel comparison ignores RGB only when both alpha bytes are zero.
- Full alpha/255 precision, non-overlapping integer geometry and actual serialized SVG verification address the major premultiplication/raster risks without inventing universal accuracy.
- Original PNG bytes remain unchanged for embedded output, labeled bitmap artwork.
- Per-file and aggregate resource limits, serial queueing and explicit fallback avoid silently resizing or switching mode.
- Real indexed fixtures, a deliberately corrupted output, ZIP byte/name roundtrips and independent review are meaningful tests.
- Current library read requests are correctly distinguished from prohibited converter uploads, and converter dependencies exclude cloud/Drive/database routes.
- Root remains sole integration/build/publication owner; disjoint engine/tests ownership reduces overlapping writes.

## Reviewed hashes

| File | SHA-256 |
| --- | --- |
| request.md | `23edc6e4cbb23c7feb8aaf26ac1b28c1bebc4f54040502ba65be7f4ee2b2af6d` |
| fix-plan.md | `1a11fa4302f042da0e6758f87b00729628e04c3f57633e52d670d6d38bcda10e` |
| test-plan.md | `cd9eeaa2ea728505f049a1965ce70cd2e251b4deb6748d62b46c05ccab29d5fe` |
| checklist.md | `5510d6f7e89b1464163e952a68f8725775ea61c7373c441dca1ea8f51987a2d8` |
| record.json before critique metadata | `9823b1171510a6d0331b4be98a9197fce8877ae9df390d6fa7e0277bd7043682` |
| src/App.tsx | `1b128e433e8e62e93bf30a155a6b903e7b2d865fa4a5af043b767dbc5b85d594` |
| src/styles.css | `b27c4ad0a62abbde5a85b460faf0b185096d61582b3269ff6794128ccfc4f5a6` |
| src/cloud.ts | `1bee53c622c4bb4bc789f02036445ec283c95ca5960d5a9cf4ccce49a17c6eca` |
| src/db.ts | `e1d19e823913b2913c7a7f48f47098066b9e6ea957c8168b933d06a2bd494770` |

This is plan-review evidence only. It establishes neither successful tests nor deployed behavior. Root must reconcile F1 before finalizing criticized readiness and applying the execution gate.
