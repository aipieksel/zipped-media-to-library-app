# Test plan — revision 7

## T1 — R2, R3, R4, R9, R10

Procedure: Run existing independent rectangle/comparator/embedded and real native browser fixtures, plus deliberate one-pixel negative control.

Expected: All established standard native cases zero; mismatch count exactly1; no false badge.

Boundary: Recorded browser and sRGB8 only.

## T2 — R5, R8, R17, R18, R19, R20, R23

Procedure: Test collection transaction/revision/path contracts; browser folder + loose imports, duplicate names, reload with completed/pending/failed records, removal during conversion and Library switching. Use two database connections/tab owners to prove live-claim non-stealing, expired-claim recovery and old-owner completion rejection; inject source and result transaction aborts; inspect saved verification time/browser/engine after reload.

Expected: One durable Uncategorized; nested names/empty folders preserved, safe collisions; source saved before queue; results survive reload; stale job never resurrects removed item; no cloud writes. A failed source transaction leaves no partial metadata/Blob/folder import; failed result transaction leaves prior state recoverable with no ready badge. Cancel/delete/retry invalidate claims; reopened saved check is explicitly historical.

Boundary: Synthetic inputs in dedicated development origin; no production collection mutation.

## T3 — R1, R5, R6, R15, R16, R17, R23

Procedure: Desktop and narrow browser journeys through top tabs, shared search/favorites/sort/tree/keyboard/move, both drop targets and synchronized previews at100/200/400/Fit.

Expected: One sidebar DOM/component with matching controls; controls remain in canvas toolbar; equal image size/origin/checker phase and synchronized pan; no clipped main actions; HTML/Images retain selection.

Boundary: Actual browser UI plus source integration tests.

## T4 — R7, R19

Procedure: Read back saved SVG and ZIP payloads after reload, duplicate names and changing mode.

Expected: Preview/verification/download bytes equal; exports include each requested ready result once with unique safe names.

Boundary: Blob anchor and ZIP content; do not claim unobserved OS delivery.

## T5 — R5, R8, R9, R10, R11, R21, R22

Procedure: Audit exact pinned tracer source/license/output; bounded browser comparison on known circle, ring hole, tiny detail, multicolor and partial alpha/gradient fixtures; inspect actual curves and independent4x known-shape reference.

Expected: Smooth output uses editable paths without bitmap/external resources, keeps dimensions and holes; shows real differences; no flattening transparency; chosen smooth route must improve the independently measured4x antialiased96px silhouette/curved-hole/thin-detail oracle over pixel geometry while retaining hole/topology/detail. A failed candidate is revised or rejected, never accepted just because its error is disclosed. Silhouette classifier negative cases cover multicolor, soft alpha fields and arbitrary translucent interiors.

Boundary: Does not establish universal recovery or accuracy on unavailable user originals.

## T6 — R5, R8, R12, R19, R20, R22, R23

Procedure: Independent review of app/storage/worker/cancel/quota/failure/keyboard/privacy; npm test, tsc and production build, repository privacy index check. Run an actual smooth conversion from the final production asset layout for each retained engine, verifying its identity and bundled local worker/WASM loading, after the build.

Expected: No unresolved high severity findings; positive and failure evidence; no runtime conversion uploads or CDN fetches; existing suite passes. Retained production tracer must execute successfully; dev-only results do not meet the asset gate.

Boundary: Local test and built source.

## T7 — R11, R12, R13, R14, R21

Procedure: Check docs/research against sources and implementation; remote checkpoint refs/tree identity; same Site source commit, audience and native deployment status.

Expected: Frequent durable commits, final main/current source and successful private publication; evidence and limits match actual execution.

Boundary: Deployment response plus supported UI smoke.


## Revision 5 — focused T5/T6 extension

Freeze an additional procedural96×96 fixture containing two separated annuli, a separated round-cap two-segment angled stroke and a small disk island. Produce native alpha with8× analytic samples and a fixed separable tent filter of radius1.25 native pixels; compute a384×384 hard-geometry reference independently with4×4 samples per reference pixel. Expected topology:4components and2holes. Verify that the input contains0,255 and partial alpha pixels that fail the old immediate-neighbor condition. Do not derive the reference from the traced SVG or resize the input into the oracle.

Positive gates: exact mode still has zero native differences; smooth uses the bumped silhouette profile with editable curved geometry and ≤16 paths; fresh native recount equals reported differing pixels; native error is never replaced with a tolerance. At4×, alpha MAE must be lower than the pixel-geometry baseline, with topology, ring-hole interiors, island and stroke endpoint/joint probes retained. The original narrow-fringe fixture's current improvement gate stays unchanged.

Negative gates: existing uniform-translucency, distinct-color, broad-gradient and partial-alpha fixtures remain rejected by silhouette detection; add a broad same-color fade with an opaque anchor, an alpha128 pocket inside an opaque body, and a detached translucent island near but separated from the opaque shape. The latter cannot gain eligibility across alpha0. A sharp right-angle/45-degree procedural case retains corner/line probes; curve parameters are not loosened. Failures require correction rather than reducing the gate.

Run the focused and full Node suites, TypeScript, native browser tests for the added shape and retained exact/smooth cases, an independent diff/privacy review, then build. Verify the changed silhouette route executes from final production assets. Reuse byte-identical unrelated runtime evidence, not inferred new behavior. Preserve earlier failed trials. Publish same private Site and inspect the actual saved live result on device if available; report any remaining classification limit without claiming a private source diagnosis that was never observed.


## Revision6 — focused continuous-contour and roundness gates

T5 adds an independent actual-SVG geometry metric over closed M/L/Q/C/Z subcontours. Match each of the four frozen analytic ring boundaries uniquely by center/radius envelope; missing or ambiguous matches fail. Sample segment bow and polar angles, includeZclosure, and combine flat/collinear subdivisions. Require≥80%genuinely curved angular coverage and maximum contiguous flat run≤15degrees for each boundary. A Q/Ctoken counts as curved only when its sampled bow reaches at least half the known-circle sagitta. Calibrate with regular8/12-gons and a decorative-collinear-Qnegative, plus a known four-cubic circlepositive. Freeze these controls/thresholds before changing the production path. Retain and report previousfailure measurements (currentcurvecoverage0–10.94%; strictline-tolerancecandidate33.55–39.35%; bothfail).

Pure contour tests cover pixel-center coordinate alignment, transparent padding, deterministic saddle connectivity, closed loops/holes, finite cubic output and explicit resource errors; no detail is silently omitted. Eligibility/reason negatives continue to preserve deliberate alpha interiors via general RGBA. Exact/embedded references and all originalqualityfixturesremainunchanged. Newengineidentitymustdescribealpha-contour/cubicgenerationandprofile3. Testclosure/quarterseamtangentsandretainsharp90degree/45degreecontrolprobes; visuallyinspectallthreefrozenexamplesat400%.

Execute fullNode/privacy/TypeScript gates, allactualbrowserfixturechecks and the new roundness gate against the exact serialized SVG. Recount native differences unchanged. Build the actualSiteworker, inspect local assets/notices/noQAdata, run the changed engine from that finalpackage and onlythenpublishsameprivateSite. The saved live user's input may be reconverted and observed only on device; do notexportsourcebytes/artwork into testsorGit. If the newmethod fails decisivegates, retainfailureandrepair/rejectit ratherthanloweringtheguard.

## T8 — R24 and existing exact/storage/export regressions

Pure tests cover static VP8, VP8L and VP8X dimension parsing and signatures, RIFF size/chunk padding/truncation, duplicate/mismatched image payloads, 20MiB/pixel limits, animation rejection (flag and ANIM/ANMF), safe output names across PNG/WebP equal stems, original-byte embedded MIME and old PNG record fallback. Unknown noncritical metadata stays bounded; ICC/EXIF handling is disclosed without claiming cross-browser equivalence.

Generate real procedural opaque lossless, opaque lossy, transparent/partial-alpha lossless and lossy-alpha WebP fixtures. In the actual browser run default pixel vectors and embedded mode: compare strict native RGBA against the decoded WebP, verify zero-only badge and complete original embedded byte equality. Exercise one eligible WebP smooth shape through the same engine and retain approximation/error disclosure. Test renamed files/MIME mismatch by signature to prevent trusting labels. Existing six PNG formats and negative one-pixel comparator remain unchanged.

Exercise a mixed PNG/WebP folder/drop batch in the real Icons UI, same-stem collisions, automatic completion and source/result persistence across reload. Verify selected original format label and actual saved SVG/ZIP bytes and unique filenames. Animation failures are useful and leave durable retryable input state rather than hanging the queue. Run actual production-built WebP default and smooth/embedded paths before release. No private user input is exported for tests.

GPR clarification: metadata inspection rejects malformed RIFF/headers, animation and allocation limits before browser decode. It is not a full VP8/VP8L entropy decoder. A structurally valid but corrupt compressed payload must instead fail in the browser decode stage, retain a useful recoverable error and never acquire a verification badge. Add both failure stages to T8. Root is the sole editor of the shared browser adapter; engine owns contour/worker/trace metadata modules.
