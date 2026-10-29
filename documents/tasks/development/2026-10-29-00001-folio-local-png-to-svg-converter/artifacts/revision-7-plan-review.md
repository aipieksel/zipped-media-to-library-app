# Revision 7 — independent combined contour and WebP plan review

Reviewer: `/root/fidelity_research`. Planner/coordinator: `/root`. GPR review of the revision-6 continuous-contour amendment and revision-7 WebP extension, completed against the file snapshot read at **2026-10-29T16:41:36.463242Z**.

**Verdict: revised / ready for execution after the coordinator's normal criticized finalization and admission. F8 is fixed in the plan. No unresolved material plan finding remains.** No application change, test pass, browser result, or release success is implied by this plan approval.

## Authority, baseline and scope

S2/R22 continues to authorize the smooth-quality correction. Revision 5's classifier source approval remains valid for its inspected hashes, but its numeric acceptance was insufficient: the coordinator's actual enlarged inspection rejected the faceted ring output. The plan correctly retains that failure and does not turn a passing MAE or isolated curve token into a successful visual result.

S3 explicitly requests WebP alongside PNG in the same Icons workflow. R24, P7 and T8 trace that extension through intake, conversion, persistence, preview and export. Static-image support with an explicit animation error is consistent with the existing static converter and APNG boundary. This adds no new workspace, upload service, telemetry, manual format-conversion step, or cloud storage contract.

The inspected baseline is `af5614eb49c19878480437d84f20d66e8435ab53`. A read-only Git comparison found no production-source or package/lock changes against that baseline during this review. Comparing the baseline and current record confirmed that all earlier request-source objects and stored request hashes are unchanged, and **S3 is the sole added source**. The original `request.md` is unchanged. Source provenance remains append-only; the coordinator still owns final helper metadata/hash reconciliation.

The reconciled checklist preserves previously verified unchanged UI/storage/exact-mode work and leaves R10, R11, R12, R14, R22 and R24 open for the combined regression, documentation and release. Checked baseline outcomes are not evidence that the new WebP/contour paths have already passed.

## F8 — decoder-stage claim, medium, fixed in plan

The first T8 record wording promised that every invalid input would fail before image-decode allocation. A bounded RIFF/header inspector cannot establish validity of the complete compressed VP8/VP8L payload without performing that decoder's work. This was a verification-boundary defect, not a request to add a JavaScript entropy decoder.

The coordinator corrected T8's expected result and appended the test-plan clarification. The reviewed contract now separates:

- Malformed container/header structure, animation and excessive dimensions: reject before invoking browser image decode.
- Structurally admissible but corrupt compressed content: fail during browser decode, retain a useful recoverable error, and never acquire a verification badge.

Both failure stages are required by T8. **Disposition: fixed_in_plan; no remaining blocker.** Google separates the container description from the compressed-image bitstream specification, which supports this distinction. Primary sources consulted on 2026-10-29: [WebP Container Specification](https://developers.google.com/speed/webp/docs/riff_container) and [WebP Lossless Bitstream Specification](https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification). This review did not implement or run a decoder.

## Continuous-contour method assessment

The proposed change addresses the observed information loss in the eligible silhouette route. It retains the already reviewed radius-three monotone eligibility and foreground guards, but obtains geometry from the original alpha samples instead of first discarding their fractional coverage into a binary mask. Exact pixel geometry and the decoded native reference remain unchanged.

The plan specifies enough coordinate and topology detail to implement and review the method concretely:

- Samples are at source-pixel centers, with one transparent padding ring and linear threshold-127.5 edge interpolation. This establishes a native-coordinate convention and permits closed boundary extraction for shapes touching the canvas edge.
- Canonical shared-edge identities prevent adjacent cells from inventing distinct representations of the same crossing. Bilinear saddle disambiguation is deterministic. Loop stitching must reject open, branched or degenerate data rather than produce a partial result.
- Every contour and hole is retained with evenodd fill semantics; there is no area-based omission or smoothing blur.
- Closed loops are divided at arc-length quarters and supported hard corners rather than fitting a whole loop with coincident endpoints. Ordinary seams and closure share explicit tangent directions; supported corners use the stated angle/straight-arm criteria.

These are implementable choices, not proof of recovered original drawing intent. The saddle convention must be tested explicitly, and fitting may approximate sampled coverage. Existing topology, native-difference and detail gates remain essential.

The dependency choice is sufficiently specific: exactly `fit-curve@0.2.0`, local-worker bundling, full notice and lock integrity. Read-only inspection of the extracted package in `.qa/alpha-contour-spike/fit-curve` confirmed version 0.2.0, MIT metadata, the included copyright notice, and no runtime dependency declaration. Its `fitCubic` implementation accepts the fifth progress callback that its declaration omits, so the narrow typed adapter is grounded in the actual inspected API. Both implementation comments and declarations define the error argument as squared error; 0.0625 corresponds to the plan's 0.25-pixel sampled-error threshold. It is not a continuous Hausdorff-distance guarantee.

The inspected MIT file retains `Copyright (c) 2014 Volker Poplawski`. Its SHA-256 is `16058f389fff2b25d8e3bf58cfe1f761d08c2d677c07aed8d07167fd1ac39f87`; the inspected source file is `8612761a19b0d2d73e5be4cacee98473a0ca1689ca536172fe68475d821d6f54`. This establishes the reviewed local API/license evidence, not the future installation's lock integrity. Root must still compare the pinned installed distribution and include the notice in the final package.

Resource limits are concrete before and during fitting: input bounds, 200,000 total raw vertices, 8,192 per loop, 20,000 loops, at most 512 points per fitting call, bounded callback count and callback point visits, plus worker timeout, output commands and SVG bytes. The 512-point subdivision also bounds recursive fitting spans and the two-point leaf case, which does not invoke the progress callback. Budget failure must reject the whole result with a useful exact/embedded retry; silent omission is not an accepted optimization. Independent implementation review must verify enforcement order, closure/tangent handling, and cleanup.

The stored procedural spike report was read as exploratory evidence only. It was not rerun, treated as a passing acceptance test, or substituted for final worker/browser execution.

## Stronger visual-quality acceptance

The revised geometric gate is materially stronger than the previously passing average-error check. It operates on the actual serialized SVG subcontours and uniquely matches each of the four known ring boundaries. Missing or ambiguous matches fail.

For each boundary, at least 80% of angular coverage must come from genuinely curved segments and no contiguous flat run may exceed 15 degrees. A Q/C token qualifies only when sampled bow reaches at least half the corresponding analytic-circle sagitta. Closure and merged collinear subdivisions count. The regular 8/12-gon and decorative-collinear-Q negatives therefore guard against the observed faceting and superficial command changes; the four-cubic circle supplies a positive calibration.

Controls and thresholds are frozen before production implementation. Original analytic input/reference bytes, MAE improvement, topology, small-detail probes, exact-native checks and the independent fresh smooth recount remain unchanged. The angular fixture is correctly excluded from a circle-specific test and retains its intentional sharp-detail checks. Seam tangent diagnostics and actual 400% visual inspection of all three fixed examples add evidence that a scalar geometry score cannot supply on its own.

The plan does not permit accepting a failing candidate by relaxing thresholds, changing the reference, or reporting its limitations. The new engine must identify actual alpha-contour/cubic generation and profile 3, rather than claiming ImageTracer generated a route that no longer uses it.

## WebP extension assessment

P7 keeps format recognition separate from intake convenience filtering. Conversion inspects the actual source bytes; neither file extension nor claimed MIME authorizes decoder behavior. Its bounded RIFF parser covers static lossy, lossless and extended payloads, chunk extents/padding, unambiguous image payload and dimension consistency, then applies the existing predecode image limits. Animation is rejected explicitly, including flagged and chunk-based cases. Unknown metadata remains bounded.

T8 combines parser-focused adversarial tests with real procedural encoded images. It requires opaque lossless, opaque lossy, alpha lossless and lossy-alpha data, plus renamed/MIME-mismatched inputs. Browser comparisons use the decoded WebP as the reference. They do not compare lossy output with an unavailable precompression image. Original bytes must remain byte-identical inside the embedded SVG with the actual `image/webp` MIME; generic Embedded bitmap wording and actual format labels avoid misrepresenting that mode as editable vector artwork.

The existing decoded-reference/native-render path, original dimensions, transparent-pixel rule, zero-only verified state and exact engine remain the common contract. The unchanged PNG fixtures and one-pixel negative comparator prevent the generalization from weakening earlier guarantees. ICC/EXIF and decoder-profile limits remain disclosed; metadata must not silently redefine the tested reference or permit an unchecked decoded dimension change.

The same durable Icons workflow must retain original source bytes, serial auto-conversion, failure recovery, folders, Uncategorized, selection and downloads for mixed batches. Optional format metadata with an old-record PNG default avoids a destructive database reset. Source bytes are re-inspected during conversion, so this compatibility default does not become decoder authority. T8 explicitly covers old records, same-stem PNG/WebP SVG-name collisions, mixed folders/drop, reload, actual saved output and ZIP identity. New WebP pixel, smooth and embedded routes must also execute through the final production package.

Procedural encoding is development-only, with reproducible script/provenance and ignored generated media. The plan does not add an encoder or fetched conversion dependency to production, export private source inputs, or alter the existing Library/cloud schema.

## Ownership, release and independent verification

The appended clarification resolves the shared-file overlap: **root is the sole editor of the common browser adapter**. The engine owner handles contour/worker/trace metadata modules; the test owner handles the independent geometry gate and frozen analytic fixtures. Root owns WebP integration, package/lock, notices, UI copy, build, record and publication. This permits parallel work without concurrent edits to the shared adapter.

P3/P7 implementation, affected tests, independent source/privacy review, the new geometric/visual gates and all T8 stages must complete before the same-private-Site release. Prior unrelated evidence may be reused only within its actual scope and unchanged bytes. The final built worker must execute the new engine and WebP routes; a development success or a successful build is insufficient. Existing input data and the old transient tab remain preserved, and any live-user follow-up stays on device.

The implementation and test agents have not received source approval from this review. This verdict admits the plan; it preserves the later independent diff review and actual browser/production evidence gates.

## Reviewed hashes

These are the final reviewed pre-finalization bytes, including F8's correction and the reconciled checklist. Root will update record/critique hashes through the current workflow helper after consuming this review.

| File | SHA-256 |
| --- | --- |
| `request.md` | `23edc6e4cbb23c7feb8aaf26ac1b28c1bebc4f54040502ba65be7f4ee2b2af6d` |
| `fix-plan.md` | `c1804f4db03baad895d40010ba2321a6695b9bde17a26ce1dc3620af6399456c` |
| `test-plan.md` | `e33338cb4511e4dc295937006180eee75848e9ff277cc951eb2e54e905f1f926` |
| `checklist.md` | `5f0e8e8a12db6606c8a4563849b10c99de54f07937b8774b9b5159e8188ac91a` |
| `record.json` before coordinator finalization | `ac40f2752ab5db61808754b1281abd789eeb43dd216afa394aac87c41b0d7357` |
| `src/png-svg.ts` | `da3fa7766285427bf73297fa8e56c667c81d8d4053ab0f0afb12139244f3034e` |
| `src/png-svg-trace.ts` | `61f64f3714560ee765781d32302a4ad76b225c1428b49c45ef0731ade6d6adae` |
| `src/png-svg-browser.ts` | `2b89be493cf24ca0dee2100d8af54d68d1ff1d11ca6a529e24261ecf07a81adf` |
| `src/png-svg-trace.worker.ts` | `2bc22af040f3b7cbb6fd887a386878caccc6d638fa940b0539f91ef2dc36fcc7` |
| `src/icon-types.ts` | `6de29c09f454663cb8cb9f7783a985dd31b277ca8c27a98abf2205cbca2bc2a9` |
| `src/icon-collection.ts` | `5b782490bb0aef889c8a4931b0986e3db703462ba23c1e32a9085d8ec39a231f` |
| `src/icon-drop.ts` | `da985e90a8ad502c512cf134ecdb88fc26a368fa97a72dcc24706210f7b039d6` |
| `src/useIconCollection.ts` | `ce494d6202ad461e95ecfd19dbcb6ec921777344d05c165f509e92b9e5ef4114` |
| `package.json` | `45f3d0f78fbeaae74ddcafe3d95f55ff2ca794f87a25c2abb30baaeae881955d` |
| `package-lock.json` | `a4cf2ce3225425412ad1a625ed2f20cbdffeac914cf1b199b80c792b15f91acc` |
| Frozen `tests/png-fixture-generator.ts` | `4a377c4d6db20f70cb09e077a70bf99ec49e1d61f994f8cb5bdd947612389145` |

The plain UTF-8 S3 text hash is `c5caece444fe23f4c7b7ebc4bdf228973ab92cf39f51911c952cba6576da8cb9`; this is identified separately from the workflow's request-object hash format. No earlier source text or stored hash was rewritten.

This review read the current 3.1.0 GPR handler and reviewer profile, the actual plan/record/checklist, baseline source and extracted dependency evidence, and the official format documents. It did not install, build, execute the prototype/tests/browser, edit production source, or change admission metadata. Only this review artifact and the critique addendum were written.
