# Revision 5 — independent corrective plan review

Reviewer: `/root/fidelity_research`. Planner and integration owner: `/root`. Reviewed **2026-10-29 16:10 UTC** under GPR. The reviewer did not author this correction plan or the classifier implementation and will not implement the production repair.

**Verdict: ready / approved for the bounded revision-5 correction, subject to the coordinator's normal criticized finalization and execution admission. No unresolved material plan finding.** This is approval of the proposed work and its acceptance gates, not evidence that the new behavior already works. No further user-permission gate is required.

## Authority and scope

The existing S2 source requests better researched image-to-SVG results as part of the integrated application, and R22 requires measured smooth-curve improvement without weakening exact mode. The later live observation reopens that same acceptance outcome. It does not authorize exporting the user's source, resetting the collection, inventing an exact reconstruction claim, or introducing a new feature/service.

The correction is appropriately limited to `src/png-svg-trace.ts`, necessary warning/profile wording in `src/png-svg-browser.ts`, procedural fixtures and affected checks. Existing shared navigation, storage transactions, imports, Library behavior, exact pixel geometry, original-byte embedding, native comparator, dependency versions, and curve settings remain outside the repair. The preserved revision-4 release evidence and source baseline provide a rollback point. Root remains the build, Git, metadata and same-private-Site publication owner.

The reported live result selected the RGBA route with 604 paths and 1,010 native differences. The plan correctly identifies the one-pixel eligibility rule as a plausible cause rather than claiming the exact guard failure was measured from private pixels. No private artwork, filename, input bytes, histogram, or page memory was read by this review.

## Algorithm review

The plan preserves the existing prerequisites: at least four alpha-255 foreground pixels, transparent background, partial-alpha edge pixels, and the same premultiplied RGB tolerance of 384. It preserves the alpha-128 mask threshold, ImageTracer parameters, actual engine reporting, source pixels, and strict final native comparison. Only the eligibility neighborhood expands.

For each partial-alpha pixel, the proposed classifier requires both of the following within at most three eight-neighbor steps:

1. A nondecreasing-alpha path to an opaque foreground pixel.
2. A nonincreasing-alpha path to transparent background, including the outside of the canvas.

These directed conditions are stronger than an undirected search for any nearby opaque and transparent pixels. In particular, a translucent island cannot obtain foreground support by crossing an alpha-zero gap, and a partial-alpha pocket enclosed by opaque pixels cannot obtain background support by crossing those opaque pixels. Capped multi-source breadth-first maps are feasible in O(pixel count) time and bounded memory under the existing 262,144-pixel smooth-input limit. The implementation review must check propagation direction, boundary seeding, distance caps and queue visitation; the plan does not require changing any broader tracing/resource limit.

This remains a bounded inference about a narrow monotone fringe. Raster data cannot prove whether an otherwise identical narrow transparency pattern was intended as coverage or as an artistic translucent effect. The plan's explicit inference language, unchanged RGBA fallback, diagnostic support and native difference disclosure are the appropriate boundary. It must not be presented as a universal semantic classifier or a guarantee of exact curve recovery.

## Decisive acceptance checks

The P3/P5 narrative, T5/T6 extension and record mappings now require evidence that can reject an unsuccessful repair:

- Freeze the procedural 96 × 96 rings/angled-stroke/island source before classifier changes. Its native samples and fixed radius-1.25 tent filter are independent of the tracer. Demonstrate that the old immediate-neighbor predicate rejects it.
- Construct the 384 × 384 reference directly from analytic geometry, not by enlarging the source or rasterizing traced output. Require four components, two holes, and preserved ring interiors, island, stroke endpoints and joint probes.
- Require actual browser selection of the bumped silhouette profile, editable curved geometry and at most 16 paths for this known fixture. A mere classifier return value or a lower path count cannot satisfy the contour-quality gate.
- Require lower 4× alpha MAE than the pixel-geometry baseline. Retain the original accepted fixture and its existing improvement gate unchanged. A failure calls for correction, not a relaxed oracle or success based only on honest error disclosure.
- Require exact mode still to produce zero native differences, and independently recount the smooth output's native RGBA differences. No nonzero difference becomes exact through a tolerance or alternative display metric.
- Retain uniform-translucency, distinct-color, broad-gradient and partial-alpha rejection cases. Add the opaque-anchored broad fade, enclosed alpha-128 pocket and detached nearby translucent island, plus sharp right-angle/45-degree detail probes.
- Run affected unit/native-browser checks, full regression gates and independent diff/privacy review. Execute the changed silhouette route from the final production asset layout. Reuse earlier unrelated runtime evidence only where the relevant bytes are demonstrably unchanged, with the planned smoke regression.

These checks address the important false-positive boundaries. They do not prove that this procedural fixture is the unavailable user's exact source or that a particular private input will necessarily be accepted. The planned on-device live follow-up and honest remaining-limit report are therefore still necessary for task closeout when that session is available.

## Local eligibility reason

The final P3 sentence and record mapping permit a concise guard-level reason in the existing Smooth warning area when the general RGBA route is chosen. This is appropriate diagnostic/provenance support within the existing interface and privacy boundary; no new control, mode, telemetry or exported data is introduced.

Implementation obligations for the admitted change are:

- Derive the message from the actual unsuccessful guard, using bounded categories such as missing opaque/background support, foreground-color variation, or unsupported alpha fringe.
- Preserve the difference between a guard result and a semantic diagnosis. Do not label an image a shadow, translucent fill, or malformed antialiasing merely because the heuristic declined it.
- Assert representative negative fixtures' actual rejection reason as well as their rejection. Render the same reason through the existing text warning path, without pixel values, coordinates, private names or histogram serialization.
- Keep the reported engine tied to the route that actually executes; an eligibility explanation must not replace native verification or disguise fallback behavior.

These are concrete implementation/readback checks within P3/T5/T6, not a request to broaden the plan.

## Review disposition

No new high- or medium-severity plan finding is open. Earlier F4's quality gate remains binding: an accepted smooth result must demonstrate improvement and preserve details; an honest approximation alone does not satisfy the requirement. Earlier F6's production-layout execution gate likewise remains binding for the changed route. The classifier and diagnostic implementation still need independent review and actual tests after admission.

This review read the actual plan, test plan, checklist, record S2/R22/P3/P5/T5, current classifier/warnings, existing unit/browser quality checks and workflow reviewer instructions. It did not modify source, tests, request sources, metadata, dependencies or builds. Only this report and the appended critique receipt were written.

## Reviewed hashes

Hashes were read at **2026-10-29T16:09:44.394711Z**, after the local eligibility-reason sentence and P3 mapping were present. `record.json` still had `planRevision: 5`, `reviewedPlanRevision: 4` and the pending review blocker; the coordinator must update that metadata after consuming this review.

| File | SHA-256 |
| --- | --- |
| `request.md` | `23edc6e4cbb23c7feb8aaf26ac1b28c1bebc4f54040502ba65be7f4ee2b2af6d` |
| `fix-plan.md` | `d38d1b06f1abc6506b1e63bd2990c6323267b4b2395bafd8f104e19da1d52ebe` |
| `test-plan.md` | `c6d4485fb466088c98094825be0d31467a202504a1454e7d1176128cef871711` |
| `checklist.md` | `efc17110f52d0998ce4a7b1a9a91a5c897a224747731a59844b39d8827efc60c` |
| `record.json` before coordinator finalization | `9f2c2fec7338dd0c710bdfd8cbcfaabc40cf1d79f8ba11dca2969c21c964a3cd` |
| `src/png-svg-trace.ts` | `70f0dea9985bb7426867cd625ceffe432127e66bbb1fdf109d82a19ff7cc7d00` |
| `src/png-svg-browser.ts` | `d7b50c564f7b4184a189afe7f00da54f023d6ad880794ba7b36163553a5b9dd3` |
| `src/png-svg.ts` | `da3fa7766285427bf73297fa8e56c667c81d8d4053ab0f0afb12139244f3034e` |
| `tests/png-svg-trace.test.ts` | `72641991086a95f8a955269f80adc898679af23b33ba1a2598b06f20c623df17` |
| `tests/png-svg-browser-check.ts` | `d1fbe85a4c7f4230fc1bda569954b245b1d34245e0ffa625323c088012e7f847` |
| `tests/png-fixture-generator.ts` | `54eeca4c91091ab7f3ffbcbb6bcc5600276a04db5d289a894f33b8c25b64576a` |

The recorded S2 request hash is `e716595ea1378a39f7257bf18ecdc9137d038f22b1a102807e5ac2a2a8222a0a`. The source baseline is the recorded revision-4 release, `7ea954a95a2bb0164ea8bb15910bcc1111c120e3`; the fingerprints above bind this review to the actual files inspected.
