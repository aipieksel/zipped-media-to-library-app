# Revision 7 — independent code review

Reviewer: `/root/fidelity_research`. Production implementation owners: `/root/converter_engine` (contours) and `/root` (WebP integration). This reviewer did not implement either production change.

**Current combined verdict: approved for the source snapshots below. No unresolved material source finding.** Runtime, visual and final-package evidence remain separately owned verification gates.

## Part 1 — frozen contour engine, 2026-10-29 16:54 UTC

**Verdict: approved for the three-file contour source scope; no unresolved material finding.** WebP integration is a separate readback below when available. This is not browser-render, visual-quality, test-execution or release approval.

The reviewed baseline is `af5614eb49c19878480437d84f20d66e8435ab53`; the admitted plan is the combined revision 7. Independent reads matched all announced frozen hashes:

| File | SHA-256 |
| --- | --- |
| `src/png-svg-contours.ts` | `cad1bc1901adb72c927eec17f201fe1968d2b78e8ccf188ea2816167840a19fb` |
| `src/png-svg-trace.ts` | `d0f8f9e2d6dc5237fcac5c10978f156f9c7d3eae417f1b9c24c8db7ee7f6efac` |
| `src/png-svg-trace.worker.ts` | `8dacd305a4b38744225a67817f42b4b26f7167ba8295989f3a8b1c1b7c2ca4e0` |

### Extraction, topology and fitting

The native-center coordinate convention and transparent padding agree with the plan. Horizontal and vertical grid edges use disjoint canonical integer identities; shared crossings therefore share vertices without rounding. The 127.5 threshold cannot coincide with an integer alpha sample, and crossing fractions must lie strictly between zero and one. Adjacent-cell interpolation does not introduce a new coordinate offset.

The case table handles all nonambiguous marching-square cases. Ambiguous cases use the stated bilinear determinant; exact ties connect foreground diagonals consistently. Each retained graph vertex must have degree two. Stitching rejects unexpected revisits, open/branched graphs, undersized loops and loop/vertex-limit violations. It retains each closed contour, including holes, without an area filter. One compound path uses evenodd filling, so holes do not depend on a particular traversal orientation.

Fitting checks finite, nonzero edge lengths and tangents. Arc-length sampling wraps over closure. Quarter breaks avoid full-loop coincident endpoints; ordinary breaks and closure use opposite representations of the same central tangent at adjoining segment ends. Hard-corner handling uses the admitted turn and straight-arm tests. Additional breaks bound endpoint-inclusive fitting spans to 512 points. The input samples and comparison reference are not mutated.

The actual installed `fit-curve` 0.2.0 source, distributed library and license equal the inspected prototype files. The runtime fifth progress argument is real; the local typed adapter is appropriately narrow. Fitted output must contain finite, bounded two-coordinate control points and a nonempty curve list before serialization. Coordinates are serialized as numeric ASCII; malformed partial output is never posted as a completed SVG.

### Bounds and failure handling

Input validation runs before extraction allocations. Total vertices, per-contour vertices, contour count, per-fit input size, fitter callbacks and callback point visits are each checked. The two-point library leaf does not call the progress callback, but the bounded span and output-command checks still cover it. Each contour accounts for its M/Z commands as well as cubic commands. ASCII byte accounting is checked before retaining each serialized contour, and the existing SVG validator/normalizer remains a second boundary.

Progress is monotone and integer-coalesced by the public generation function, so the worker emits at most 101 contour-progress values. The worker catches errors and posts an error rather than a partial successful result. Parent-owned timeout/cancellation still terminates this synchronous worker; those lifecycle paths are not changed in the three-file diff.

The hard-corner suppression loop can compare multiple accepted corners for each candidate; it is not counted as fitter callback work and is not asserted to be globally linear. Its work is bounded by the explicit per-loop/total-vertex limits and worker timeout. No timing benchmark or claim about every worst-case input is made by this source review.

### Integration, identity and privacy

The worker's silhouette branch now calls the native alpha-contour generator; general RGBA ImageTracer code and its parameters remain unchanged. The result still travels through the existing SVG result message and main-thread normalization. The compound path's evenodd attribute is accepted and retained by that normalizer, and the measured foreground color is restored there.

The silhouette identity truthfully reports `Native alpha contours`, `marching squares 1 / fit-curve 0.2.0 / silhouette profile 3`. The extra `original-webp` type alternative and generic Embedded bitmap retry wording support the separately reviewed format extension. The radius-three classifier itself is unchanged. No new network, URL, storage, private-payload export or markup-insertion path is introduced in these files.

### Evidence boundary

Read-only inspection also covered the frozen contour-test source: all 16 cases, nontrivial saddles, native-center translation/padding, alpha interpolation, retained holes/details, calibrated roundness, tangent continuity, sharp-detail probes and explicit resource rejections are represented. The reviewer did not run these tests. The test owner's reported 33 focused passes and the engine owner's prototype-byte equality are attributed reports, not fresh execution evidence from this review.

Actual native rendering, unchanged MAE/topology gates, the new 80%/15-degree circular-contour gate, enlarged visual acceptance and final production-worker execution remain coordinator-owned gates. Correct extraction/fitting source cannot establish that the private live input is now visually satisfactory.

Only this report was written. No source fix, test modification, dependency installation, build or browser operation was performed by the reviewer.

## Part 2 — frozen WebP integration, 2026-10-29 16:59 UTC

**Verdict: approved for the inspected WebP integration source.** The one small wording inconsistency noted during review is resolved. No new functional, privacy, storage or accessibility blocker was found in the diff against `af5614eb49c19878480437d84f20d66e8435ab53`.

### Format validation and fidelity

`inspectRaster` selects PNG or WebP from actual bytes. WebP container inspection bounds total input and chunk count, checks declared RIFF size and padding, validates supported image-header signatures/versions and dimensions, rejects duplicate still-image payloads, and matches extended-canvas dimensions to the contained image. Animation flags and ANIM/ANMF chunks produce an explicit unsupported-animation error. Chunk arithmetic uses ordinary safe-range JavaScript numbers; out-of-bounds data is rejected before header reads that need those bytes.

The decoder creates the image Blob with the inspected MIME, rather than trusting the incoming extension or File.type. It checks the browser's decoded dimensions against the bounded header dimensions before allocating the native canvas. A decoder/orientation mismatch fails explicitly rather than resizing. Browser-native sRGB RGBA8 remains the reference. Lossy and EXIF/profile warnings state the relevant limitation without promising precompression recovery or cross-browser agreement.

This is container/header validation, not a complete compressed-bitstream decoder. Structurally admissible corrupt compressed content can still fail in `withImage`; the existing error/timeout path releases the image URL and prevents a result from reaching completion. This respects the resolved F8 two-stage boundary. No unsupported-format source is previewed before successful source decoding and a saved result.

Both public entry points use the same conversion core. The established PNG-only entry point remains strict for compatibility; the new raster entry point uses byte-based dispatch. Exact rectangle generation and the native SVG comparator are unchanged apart from generic error wording. Smooth conversion receives the same decoded source and reports its actual engine. Verification still renders the exact output string and reserves verified status for zero visible differences.

WebP embedding uses the original bytes, `image/webp`, declared native dimensions and an exact base64-size/output bound. It performs no canvas encoding. The PNG embedded path retains its existing implementation. `sourceFormat` and original-WebP engine provenance are returned from the inspected bytes, so a misleading intake label does not determine the saved successful format.

### Durable workflow, previews and exports

The change keeps the existing database version and stores; there is no reset, migration or new cloud path. Intake accepts PNG/WebP hints and persists immutable original bytes with an optional MIME hint. Conversion rechecks those bytes. Successful completion atomically records the real source MIME with its output and metadata. Missing metadata on an old PNG row defaults to PNG. Claims, revision checks, cancellation and stale-result suppression are unchanged.

The queue reconstructs a File and calls the general raster converter; an intake MIME hint cannot bypass byte inspection. The preview derives the successful format from result metadata and creates a correctly typed source slice. URL cleanup and selected-id/revision guarding remain intact. This also corrects display behavior for a PNG named as WebP or the reverse, while preserving the exact original bytes.

The existing filename allocator strips either supported terminal extension and retains its Unicode normalization, unsafe-character handling and case-insensitive collision allocation. ZIP safety checks are unchanged. Mixed same-stem inputs therefore use the same non-overwriting output-name mechanism. Actual saved/downloaded-byte evidence remains a runtime obligation, not a consequence inferred solely from the allocator.

App changes are limited to the existing picker accept list, format-specific labels and help/drop copy. The shared sidebar, navigation, controls, modal/focus behavior, hidden file-input structure and Library branch are unchanged. Original-preview accessible names now use the actual saved format; Embedded bitmap and approximation wording remain explicit. No new interactive surface or raw-markup rendering is added. This is a static accessibility check, not a new keyboard/screen-reader execution claim.

### Dependency and privacy readback

The root package and lockfile pin `fit-curve` exactly to 0.2.0 with npm integrity metadata. Installed source/library/license hashes match those inspected in Part 1. The notice document contains the exact fitting-license text, including its original copyright line. The contour dependency is imported by the local tracing worker; no encoder or conversion service is added to production.

The inspected new parser, adapter and storage diffs contain no conversion upload, telemetry, remote decoder, imported private artifact or database-deletion path. Source admission remains metadata-first and the actual pixel buffer stays local. Existing unrelated Library network behavior is not reclassified as part of Icons.

**Minor copy observation — resolved:** the shared rectangle-limit error initially still recommended Embedded PNG for a WebP input. Root changed it to generic image/Embedded bitmap/original-bytes wording. The updated `src/png-svg.ts` hash below includes that nonfunctional repair.

### Final source fingerprints

Root's integration files were read at **2026-10-29T16:58:58.430918Z**; the copy fix and unchanged core fingerprints were read back at **2026-10-29T16:59:46.038958Z**.

| File | SHA-256 |
| --- | --- |
| `src/raster-input.ts` | `36122c2786ac4d7f47497f583d35bd872bc8cd89f09d1c1eb5f5883208446b0f` |
| `src/png-svg-browser.ts` | `b847a3bf3a6a0fe8b62613f40857c593ab0080cb4bb3a2721e9b5bb035fadaac` |
| `src/png-svg.ts` after copy repair | `0d3db3fd3a62854dd8dc43e8f50b6191cf4807b13da9a413b5871aa24e1b42b9` |
| `src/icon-drop.ts` | `3fae4a23156db5ed409979003cb4557436b4d2128cb1347d0d8d3a92187b8bf6` |
| `src/icon-types.ts` | `14482077bc5fb2a3482308d8fd9df4134ce01463efc23ce3cb3b9facad974391` |
| `src/icon-collection.ts` | `4dcf6370bcdf1d79b95615217b3badbfede97bde69113400913b7069bf6ae3eb` |
| `src/useIconCollection.ts` | `360e32613beb9c62738da3675fc6bd9842f9a28fad1119fed82eb0aec5b2557c` |
| `src/components/PngSvgWorkspace.tsx` | `603dce2a17b831e1e4e250489b4f1114b7a7760030e743546d22b7bb323d8319` |
| `src/App.tsx` | `b0152b868cbef1d2973ca525c121502e5b1a851528f1b83afc171eaaea2ee972` |
| `src/png-svg-download.ts` | `cb338123b32162ca4852777468318a33c5511c6499bcd0c7df3ea2fa2ee5589f` |
| `package.json` | `2fa36e292f9e54dae658cbeb58d196d55586b27a3fe2e0bba91ee2796790fa3b` |
| `package-lock.json` | `60a5a99230cd4fd7e9936275ba34326dbd58e594fbec9a9bb148ba38228ac682` |
| `THIRD_PARTY_NOTICES.md` | `8014f45a255475ab24584864e8030a6804d0772eaae434f2e002532ed465e07f` |

### Remaining verification boundary

The coordinator subsequently reported a 31/31 actual contour/native run and an enlarged visual inspection with round contours. Those are coordinator observations, not executions performed by this reviewer. This source verdict does not invent a fresh WebP browser pass, mixed-format persistence/export result, production asset proof or publication result. Those must be recorded by their actual verification owner before release. No tests, builds or browsers were run during this review, and only this artifact was changed.
