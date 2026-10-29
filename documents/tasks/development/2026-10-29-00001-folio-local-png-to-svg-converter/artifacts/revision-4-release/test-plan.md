# Test plan — revision 4

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
