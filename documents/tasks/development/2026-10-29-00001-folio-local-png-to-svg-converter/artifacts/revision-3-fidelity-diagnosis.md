# Revision 3 — fidelity and preview diagnosis

Assessor: `/root/converter_engine`. Date: 2026-10-29. Stage: read-only assessment under the existing development record. This actor authored the current engine and browser harness; this report is a fresh source diagnosis, not an independent certification of that work. Current dependency/tracer research is owned by `/root/fidelity_research`.

## Finding and decision boundary

The existing implementation produces pixel-grid geometry. It does not recover curves. Its source makes enlarged pixelation intentional in two places: the downloadable SVG contains `shape-rendering="crispEdges"`, and both displayed images receive `image-rendering: pixelated` whenever the selected zoom is 100%, 200%, or 400%. Consequently, a blocky 400% image is compatible with the existing native-size fidelity contract. Removing the CSS hint would change presentation, but would not turn rectangular pixels into recovered smooth curves. Evidence: `src/png-svg.ts:192–205`; `src/components/PngSvgWorkspace.tsx:258,306,310–311`; `src/components/png-svg.css:31`.

No static false-positive path was found in the native verification pipeline. It separately renders the actual serialized SVG, compares it to the original decoded pixel array, and returns `verified` only for a strict zero count. The more likely product gap is that the current meaning of “verified” is narrower than an expectation of smooth, original-looking artwork at enlarged sizes. There are also concrete preview synchronization and test-coverage gaps worth addressing before attributing the complaint solely to tracing quality.

The two reported user images were not supplied to this assessor as original bytes. Their exact profiles, dimensions, image regions, display scale, and intended higher-resolution contours have not been established here. This report does not claim to reproduce their visual mismatch or identify one proven image-specific cause.

## Source ownership and maintained contracts

| ID | Contract and observed owner/callers | Evidence and existing coverage | Required boundary for the next plan |
| --- | --- | --- | --- |
| C14 | Exact native fidelity belongs to `verifySvgPixels` and `compareVisiblePixels`; `convertPng` calls verification before returning the result. | `src/png-svg-browser.ts:232–276`; `src/png-svg.ts:237–249`. Node comparator tests cover RGB, alpha, zero-alpha invisibility and one-count-per-pixel. Browser harness exercises actual serialized rendering and a deliberate one-pixel alteration. | Keep strict zero-difference semantics. Approximate tracing quality must be a separate metric/status; never relax this predicate or compare only selected channels. |
| C15 | The source reference is browser-decoded RGBA8 in an sRGB canvas. | `decodePngPixels`, `readNativePixels`, `withImage` in `src/png-svg-browser.ts:97–171`. Canvas bitmap dimensions equal IHDR dimensions; no CSS, DPR, scaling, background fill or crop is used. | State the reference explicitly. A direct PNG image preview and an sRGB readback are distinct rendering paths, especially for color metadata or higher source precision. |
| C16 | The pixel engine preserves all visible decoded RGBA samples as disjoint integer rectangles. | `mergePixelRectangles` and `createPixelSvg`, `src/png-svg.ts:150–213`; independent reconstruction in `tests/png-svg.test.ts:71–102,144–196`. | Retain this reliable exact mode and its bounds. Tracing must not replace or silently alter it. Full `alpha / 255` serialization is already present. |
| C17 | Worker ownership and serial batch cancellation are established. | `src/png-svg-browser.ts:174–229`, `src/png-svg.worker.ts`, `PngSvgWorkspace.processQueue`. Source pixels are copied before transfer, and worker termination occurs on success/error/abort/timeout. | A new tracer must run within equivalent termination, allocation and output-size boundaries. Do not move expensive fitting onto the React event thread. |
| C18 | The result string, preview and downloads share the generated SVG content. | `PngSvgWorkspace.tsx:143–145,223–244,310–311`. The preview Blob and individual/ZIP payloads are made from `result.svg`. Recorded one-shot download observations compare actual payloads against previews. | Keep representation metadata, displayed result and downloaded content bound to the same selected candidate. An Auto request needs a distinct actual output kind. |
| C19 | Zoom state is shared but each preview image/surface lays out and scrolls independently. | `PngSvgWorkspace.tsx:258,309–311`; `png-svg.css:28–31`. Explicit zoom gives both equal CSS width/height. Fit relies on intrinsic sizes and each surface's independent `max-width`/`max-height`. | Introduce a common comparison scale and coordinate origin; synchronize pan or provide one shared overlay/wipe viewport. Preserve an actual rendered SVG preview. |
| C20 | Present native success does not verify enlarged rendering or smooth recovery. | `artifacts/browser-verification.md`: Chrome 155, Linux, DPR 1; 19 browser checks; the measured DOM-size case is 16 × 12 at 100%. `tests/png-svg-browser-check.ts:169–227` rasterizes at native dimensions. | Add explicit enlarged/fractional-scale and visual reconstruction checks appropriate to any new feature. Record actual browser/DPR coverage. |
| C21 | Procedural fixtures are valid but intentionally narrow. | `tests/png-fixture-generator.ts:127–169`; fixture decoding in `tests/png-svg.test.ts:38–68`. Seven small fixtures, stored DEFLATE, filter zero, RGBA8 or 2-bit indexed palette, no embedded profile/interlacing/16-bit source. | Add only cases needed for the new curve/preview/color claims. Preserve all existing positive native and negative-control assertions. |
| C22 | Existing conversion paths are local and generated SVG markup is tightly controlled. | `src/png-svg.ts`, `src/png-svg-browser.ts`, `src/png-svg.worker.ts`, `src/png-svg-download.ts`; existing code/privacy review artifacts. Geometry contains generated numeric attributes; embedded content is original PNG bytes. | A tracer adds a new dependency and output surface. Bundle all runtime assets locally, validate generated output, retain privacy review and avoid external references in SVG. |
| C23 | Current mode/result/UI APIs assume two exact-purpose representations. | `ConversionMode` in `src/png-svg.ts:2`; `PngSvgResult` in `src/png-svg-browser.ts:19–29`; `modeLabel`, `fidelityLabel`, result tags and stats in `PngSvgWorkspace.tsx`. | Root owns product/navigation/persistence changes. Extend contracts deliberately so an automatic fallback cannot be labeled curves or editable vectors when it is embedded bitmap. |

## Native comparison audit

### What is proven in source

1. `decodePngPixels` validates PNG structure and dimensions before allocation, then draws the original PNG at native size onto a transparent canvas. It does not resize to a thumbnail or composite onto the checkerboard.
2. The worker receives `pixels.slice()`, so transferring its buffer does not detach or mutate the reference subsequently used for comparison.
3. `verifySvgPixels` creates an SVG Blob from the finished string and invokes a fresh image decode/canvas readback. It does not merely re-paint the same rectangle list into a reference buffer.
4. `compareVisiblePixels` counts any alpha difference and any RGB difference when either pixel is visible. Only RGB values hidden under alpha zero on both sides are ignored. There is no tolerance or percentage threshold.
5. Rendering failures produce `unavailable` with a null difference count, and aborts reject. The UI's headline checks both `status === 'verified'` and a zero count.
6. Download and preview construction do not optimize, trace, resample or otherwise alter the checked SVG string afterward.

Evidence: `src/png-svg-browser.ts:138–171,184–225,232–276`; `src/png-svg.ts:237–249`; `src/components/PngSvgWorkspace.tsx:32–35,143–145,223–244`.

The recorded baseline browser evidence is therefore meaningful for its stated scope: all seven synthetic pixel cases and the embedded partial-alpha case passed actual native rendering in Chrome 155. This assessment has not rerun those cases. See `artifacts/browser-verification.md` for the original execution record.

### Limits that can resemble a false positive to a user

**One raster scale is not a geometric reconstruction proof.** Different shapes can rasterize to the same small grid while differing between pixel samples or at higher resolution. In the current algorithm the geometry is explicitly the pixel grid. A native zero proves the chosen raster comparison, not recovery of an unavailable source curve.

**RGBA8 readback is the comparison reference, not the PNG's full original sample representation.** The app uses an 8-bit canvas output even for accepted 16-bit PNGs. Source profiles are decoded into sRGB. Existing warnings recognize both constraints. A native zero cannot certify preservation of discarded precision or colors outside that reference. The original preview uses the original PNG Blob directly, while the pixel SVG uses the converted RGB values. A profile/display discrepancy is a plausible hypothesis for a particular input, not a reproduced defect in the supplied evidence. See `src/png-svg-browser.ts:146–155,264–266` and the alpha/color-space research already recorded in `artifacts/research.md`.

**Alpha precision is already handled carefully, but coverage is finite.** The geometry serializer uses the full JavaScript `a / 255` value. The recorded sweep covers every alpha value across ten colors, not every RGB/alpha combination or every renderer. Lossy premultiplied-alpha readback is already acknowledged by the original research. If a further case fails, report the real count and investigate the decoding/rendering round trip; introducing an alpha threshold would conceal visible data loss.

**sRGB negotiation has a modest capability gap.** `readNativePixels` rejects a reported non-sRGB `ImageData.colorSpace`, but accepts an absent `colorSpace` property. This supports older implementations permissively, while the UI still says sRGB. This is not an observed Chrome 155 defect. A next revision can explicitly confirm the context/readback capability, or qualify verification scope when the browser cannot report it, instead of certifying an unconfirmed color space.

## Preview findings

### P1 — forced pixel display is certain

At 400%, both images are given four times their native CSS dimensions and `.pixel-zoom`. This is a pixel-inspection presentation, not a natural enlarged appearance. The exported pixel SVG also requests crisp edges. If the user's intent is smoothly scalable icon contours, the current result cannot meet that intent regardless of the correctness of the native badge.

Recommended product distinction for the reviewed plan: make a pixel-inspection presentation explicit, and render any genuine curve result normally. Do not place a blanket `image-rendering: pixelated` rule on a curve preview. Keep the pixel-preserving option available and accurately named.

### P2 — equal CSS dimensions do not establish identical display sampling

At fixed zoom, `imageStyle` supplies equal width and height; there is no static evidence of an accidental factor-of-four error on only one side. In Fit, however, each `<img>` independently resolves its own intrinsic and maximum dimensions. The panels can also occupy fractional CSS positions. The PNG can be resampled as a bitmap while SVG geometry is rasterized at the display scale; the SVG's crisp-edge hint does not establish the same sampling operation as the raster's display path. Browser zoom and fractional device-pixel ratios can turn an integer CSS zoom into fractional device-pixel placement.

The size/sampling discrepancy is a testable risk, not a measured failure. A controlled reproduction should record both image rectangles, image origin within each surface, scale, scroll offsets, devicePixelRatio and page zoom. Test native/200%/400%, plus representative fractional Fit sizes. Do not conclude that removing `crispEdges` alone repairs curve fidelity.

### P3 — the comparison has no shared pan or image-anchored background

Each surface independently uses `overflow: auto`; no scroll synchronization is registered. At enlarged sizes, a user can view different source regions. The checkerboard is positioned at the surface's center, not explicitly anchored to image pixels. Different surface dimensions/positions can put translucent pixels over different checker phases even though their RGBA is identical.

A common comparison transform and synchronized pan, or a shared overlay/wipe viewport, would remove this ambiguity. Light and dark solid backgrounds should remain available. The shared comparison must not become a replacement raster disguised as a live SVG preview.

### P4 — the native scope should remain visible beside the result

The current detailed status already says the checked dimensions and sRGB/browser scope, and the expanded help explains enlarged pixelation. The large “Pixel match verified” headline alone can still be read as a broader aesthetic guarantee. A concise always-visible qualifier such as “Native-size pixel match” can make the verified claim clearer. If approximate curves are introduced, show their actual native differing-pixel count and a separately named quality measure; never reuse the exact badge based on a low average error.

## Baseline fixture blind spots relevant to this revision

| Gap | Why existing checks cannot decide it | Bounded new evidence to require if the corresponding change is selected |
| --- | --- | --- |
| Smooth contour recovery | The antialiased fixture is a 15 × 13 sampled circle. Existing assertions compare its native pixel grid; no higher-resolution target is used. | Procedurally generate known circles/ellipses, rounded rectangles, diagonal strokes and holes at native and independent 4× resolution. Compare a traced candidate against the independently generated high-resolution shape as well as its native PNG. |
| Detail loss under a small global average error | Existing vectors are exact; no quality heuristic selects approximations. | Include a large transparent field with a tiny meaningful mark, a one-pixel gap, a ring hole, close parallel strokes and a tiny contrasting island. Require retained bounds/topology/detail or force an exact fallback. |
| Gradients and arbitrary transparency | The alpha sweep tests precision, but does not test whether a tracer correctly models soft shadows, gradients or overlapping colored transparency. | Include soft colored alpha edges and gradient interiors. Verify that unsupported candidates are rejected or visibly labeled as approximate; never flatten onto white before tracing. |
| Pixel art versus smooth artwork | Current mode preserves both uniformly; it has no need to classify user intent. | Include checkerboard pixel art, intentional stair steps and one-pixel line work so automatic smoothing does not erase an intentional grid. |
| Fit/enlargement alignment | The browser harness checks native conversion, and the UI evidence measures one 16 × 12 native box. | Measure both display boxes/transforms and compare identical regions at 1×, 2×, 4× and fractional Fit, on checker/light/dark. Include panning after zoom. |
| Profile and source precision | All seven fixtures are unprofiled RGBA8 or one indexed palette; metadata tests merely accept those formats. | Add a source-generated tagged sRGB/gamma case and, if broader claims are made, an actual profiled/16-bit fixture with a known interpretation. Require accurate scope labels. No unsupported wide-gamut accuracy claim. |
| Other browser engines/DPR | Recorded native evidence is Chrome 155 at DPR 1. | Record any additional engine/DPR actually exercised. Do not describe a changed CSS preview as universally identical without runtime evidence. |
| General PNG variants | Procedural fixtures use filter zero, stored DEFLATE and noninterlaced layouts; legal grayscale/truecolor/16-bit/Adam7 variants are accepted by the header inspector but not represented. | Only add targeted variants when a new decoder or broader decoding claim is introduced. A tracer should reuse the native decoder instead of casually expanding the decoding surface. |

The current Node reconstruction tests have useful independence: they paint returned rectangles directly and verify exact coverage, rather than calling the SVG generator as the oracle. The browser suite also includes a real one-visible-pixel mutation. These checks should remain unchanged in meaning. Their limitation is the scope of the desired output, not that they are superficial string-only tests.

## Constraints for adopting a browser-local tracer

These are implementation constraints for the planner, not a package recommendation. Package capability/version/license assessment is delegated separately.

1. **Separate intent from output.** Model an automatic request independently from the actual representation (`curves`, `pixels`, or `embedded`). Save the chosen strategy and fallback reason with the result. A failed approximation must not produce a bitmap labeled editable vectors.
2. **Define what automatic optimization values.** If zero native error is the sole objective, exact pixel geometry always wins over a nonzero tracing candidate; that policy cannot promise smoother contours. If smoothness is preferred with a bounded error, the product must present that as a measured approximation. Select thresholds from documented positive/negative fixtures, not from an unvalidated “99% accurate” score.
3. **Keep native verification independent.** Rasterize the candidate's actual downloadable SVG and retain the strict differing-pixel count. For a heuristic quality score, use transparent-aware metrics and report their definition. Check alpha/edge error and small features, because a large empty background can dilute a global mean error.
4. **Do not treat a magnified PNG as the unknown original vector.** A 4× nearest-neighbor or filtered PNG is a display reference, not ground truth for an unavailable smooth curve. Synthetic known-shape tests can provide that independent high-resolution oracle. User artwork still requires honest visual judgment and visible approximation limits.
5. **Respect alpha and holes.** A tracer that accepts only opaque RGB must not receive a white-composited version of transparent input without an explicit user choice. Assess alpha-aware paths/masks or restrict eligible inputs and fall back. Color/layer compositing, fill rules, holes, tiny islands and neighboring partial-alpha regions need decisive cases.
6. **Retain bounded work.** Use a local worker with termination on cancel/timeout/error. Bound source size, contour/layer count, path commands, output bytes and candidate attempts. Limit per-candidate buffers; do not retain full-resolution reference/render arrays for every item in a 100-file batch. WASM initialization and temporary layers count toward memory and cancellation behavior.
7. **Bundle runtime dependencies.** No conversion-time CDN fetch, upload or external tracer endpoint. Review license, browser entry points, worker/WASM loading, generated SVG external references and reproducible asset inclusion. If WASM is selected, reconcile its app-owned asset with repository privacy rules instead of adding a broad binary-file exemption.
8. **Preserve exact fallbacks and export safety.** Keep original-byte embedded output and pixel mode. Preserve source dimensions, filename allocation, ZIP integrity and checked-content identity. Treat optimizer/postprocessor changes as a new candidate that must be reverified.

## Recommended sequence for planning

First establish the latest user's intended success criterion and inspect the two actual inputs locally if they remain available to the parent. Record native count and display geometry at the complained-about zoom without copying user media into the repository. Fix any proven comparison alignment defect independently of curve inference.

Then select a bounded local tracing candidate from the separate research, if smooth editable contours are the intended improvement. Add automatic selection with truthful result-kind labels, explicit approximation metrics, and exact fallback. Retain native comparison as a distinct invariant and improve preview scaling/panning so the user can assess the tradeoff directly.

Before release, require the existing seven native positive cases and negative controls to retain their strict behavior, then exercise known-shape enlargement, tiny-feature protection, alpha handling, selected fallback behavior and worker cancellation. Recheck actual downloaded SVG/ZIP payloads after introducing any new serializer or optimizer. Root owns integrating these criteria into the reviewed revision-3 plan; no application changes are authorized by this diagnosis alone.

## Inspection and execution limits

Read `src/png-svg.ts`, `src/png-svg-browser.ts`, `src/png-svg.worker.ts`, the relevant PNG workspace component/CSS, existing pure tests, fixture generator, browser harness and prior assessment/research/verification artifacts. The canonical assessment-only stage instructions were read. This task did not run tests, build, browser automation, dependency installation or Git commands, and changed only this text artifact. No fresh external package research was performed, avoiding duplication with the assigned research actor. No user image bytes, names or visual content are included in this report.
