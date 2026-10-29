# Revision 7 verification — ongoing

## Continuous alpha contour source and focused tests

Independent reviewer /root/fidelity_research found no blocking contour issue in the frozen three-file engine patch. Native pixel-center sampling, shared crossings, deterministic saddle decisions, loop closure, retained holes, fit span/work/output budgets and finite-output rejection match the reviewed plan. The pinned package and exact MIT license were checked against the prototype. New tests by /root/codebase_assessment passed 33/33 with `node --import tsx --test tests/png-svg-curve-metrics.test.ts tests/png-svg-contours.test.ts tests/png-svg-trace.test.ts`; scoped strict TypeScript also exited 0. Root's `npx tsc -b --pretty false` passed after the initial WebP integration. Fitter callback and point-visit caps additionally received independent source review.

## Actual browser renderer: 31 passed, 0 failed

Root executed the development harness through the supported cloud browser at `http://terminal.local:4173/.qa/png-svg-check.html`. Chrome 155 on Linux, sRGB RGBA8. Final report completed 2026-10-29T16:55:58.413Z. One initial run returned to Ready during a development reload after the new dependency; it was not counted as completed. The complete rerun passed all 31 checks. These observer receipts summarize the DOM-visible report; they are not a separately downloaded report artifact.

| Frozen procedural input | Pixel-grid alpha MAE at 4× | Smooth alpha MAE at 4× | Improvement | Native differing pixels | Actual SVG |
| --- | ---: | ---: | ---: | ---: | --- |
| Original 96px silhouette | 2.7148980035 | 0.6459554036 | 76.2070% | 397 / 9216 | 1549 bytes, one compound path |
| Resampled 96px rings/stroke/island | 5.8315836589 | 0.8460015191 | 85.4928% | 1289 / 9216 | 2326 bytes, one compound path |
| 32px angular control | Previous baseline retained | 3.5572509766 | Not used as circular-shape gate | 122 / 1024 | 1352 bytes, one compound path |

The independent analytic targets and frozen source bytes were unchanged. Both known smooth fixtures preserve required topology: original 2 components/1 hole; resampled 4 components/2 holes. All ten resampled feature probes and all six angular probes passed. Every resampled circular boundary has four genuine cubic segments, 100% curved angular coverage and zero degrees of flat run; maximum seam tangent jump is below 0.0001 degrees. The actual normalized/downloadable SVG, not only the prototype, passed that geometric check. Three alpha-field/interior/island rejection cases retained their tested alpha values (121, 128, 128) through general RGBA routing. Exact PNG categories and deliberate one-pixel mismatch checks passed unchanged.

Root inspected the rendered actual SVG beside pixel geometry and the independent 4× target. The rings are round rather than long straight facets; holes, island and stroke are visible. The separate prototype angular screenshot shows some corner rounding, so these checks are not a claim of exact sharp-corner recovery. Smooth mode still reports every native difference, and the resampled case deliberately does not get an exact-match badge despite the much better enlarged contour.

Actual engine: Native alpha contours — marching squares 1 / fit-curve 0.2.0 / silhouette profile 3. General RGBA ImageTracer and opaque VTracer retain their existing routes.

## Still pending at this checkpoint

Real WebP encoded fixtures, mixed-format persistent UI/import/export, full suite after those tests, final production-package execution, same private Site publication and saved live-input observation. No private user media is included in this artifact.

## WebP unit and native-browser verification

Root `npm test` passed 252 application tests and all four repository-privacy tests, zero failures, with one pre-existing optional Library fixture skipped. That run included two generated-WebP assertions. Test portability review then moved those exact two assertions into required-fixture `tests/webp-encoded.check.ts`, leaving 23 self-contained WebP structural tests in the default suite. The test author reran both: 23/23 and 2/2, zero failures. No test was weakened or skipped. Default-suite application coverage is consequently 250 passing cases plus the existing optional skip; the two encoded cases remain a separately required QA invocation. The root TypeScript project check also passed at the earlier integration checkpoint, with a final rerun pending below.

Actual WebP browser harness at `/.qa/webp-check.html`, Chrome155/Linux/sRGB RGBA8, completed 2026-10-29T17:07:54.919Z: **21 passed, zero failed**. Real fixture encoding: Pillow12.3.0/libwebp1.6.0. Opaque lossless, opaque lossy, alpha lossless, alpha lossy and 96px monochrome WebPs all passed exact pixel and original-byte embedded modes with zero native differences and a separate SVG raster recount. Embedded bytes and image/webp MIME are unchanged. Wrong filename/MIME hints are corrected by actual byte signatures. Equivalent lossless PNG/WebP controls decode identically; strict PNG compatibility remains intact. The 96px WebP smooth case uses actual profile3, one1781-byte compound path, and reports435/9216 differing pixels, confirmed by independent recount.

Animated, oversized and malformed-RIFF WebPs were rejected with zero Image constructor starts. A structurally readable corrupt VP8 stream reached exactly one browser decoder, failed with useful feedback and produced no result. Pre-aborted conversion allocated no Image. A deliberately altered output pixel returned exactly one visible difference.

Failures preserved: the first harness attempt received HTML instead of its manifest from the import.meta asset-relative directory URL. The QA module now explicitly uses the same-origin /.qa/webp/ route and asserts the manifest content type; runtime code was unchanged. Next run passed20/21: Chrome155 decoded a header-only32x24VP8L control that Pillow rejected, so it did not exercise the expected browser error branch. The assertion was retained. A structurally valid VP8 keyframe header declaring an absent compressed partition replaced that negative control; Pillow and Chrome both reject its payload. This demonstrates decoder-dependent acceptance, not universal compressed-stream validation. The corrected input is30bytes, SHA25605ee1b4755cda560d64fe887393f10b572d0ed852b39151f75d4e417e114eb48. Final21/21 was run against the corrected control. Fixture binaries remain ignored; the source generator retains the prior finding.

Independent combined source review is recorded in revision-7-code-review.md; all reviewed runtime/package/license hashes matched the inspected patch. Mixed-format persistent UI/export and final production-package/publication remain pending.
