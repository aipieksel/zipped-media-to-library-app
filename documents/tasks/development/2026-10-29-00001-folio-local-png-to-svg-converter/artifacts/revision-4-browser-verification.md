# Revision 4 — actual browser verification

Coordinator observations from the dedicated development origin `http://terminal.local:4173/`, using the CUA supported browser API and authored development harnesses. All inputs are procedural. Browser: Chrome 155.0.0.0 on Linux, device pixel ratio 1. These results do not establish behavior in other browser engines or color profiles. Synthetic DOM directory entries exercise the application's handling, not a physical operating-system drag gesture.

## Durable collection — 13 passed, 0 failed

The real IndexedDB harness completed at 2026-10-29T15:04:53.800Z. It opened independent connections to uniquely named QA databases and did not reset the app collection.

| Executed contract | Observed result |
| --- | --- |
| Uncategorized after close/reopen | Present with reserved ID; empty folder retained; snapshots contain metadata only |
| Loose import and source bytes | Four exact original Blobs retained; queued rows and unique SVG names survive reopen |
| Nested/empty/duplicate directory roots | Stable parent IDs; three empty folders; duplicate roots and a user folder named Uncategorized get distinct safe names |
| Invalid path atomic rejection | Five invalid cases rejected; all stores unchanged |
| Moves, favorites, preferences and sibling names | Stable item/source identity, unique sibling names, saved zoom/background/mode/order/selection |
| Native source transaction abort | Abort injected after a real add request; folder/source/item stores all rolled back; subsequent import recovered |
| Native result transaction abort | No ready state or SVG output persisted after abort; same current claim recovered |
| Independent job owners and lease expiry | Live lease not stolen; heartbeat extended expiry; old heartbeat/completion/failure rejected after replacement |
| Retry | Revision and mode changed; every stale mutation rejected; previous output removed when requeued |
| Cancel | Cancelled revision survived reopen and did not automatically restart |
| Stop all | Queued/processing revisions cancelled; existing ready output retained |
| Delete | Source/output/item rows removed; stale results could not resurrect them; reserved folder remained |
| Ready/queued/failed reopen | Exact SVG and source bytes, engine identity, saved native check and error state persisted; only queued work resumed |

The saved-result check performed an actual 16 × 12 conversion: six rectangles, 486 SVG bytes, zero of 192 visible pixels different. Its saved provenance recorded `srgb`, `rgba8`, the actual browser and check timestamp. No unhandled abort rejections were reported.

## Initial engine quality gate — 27 passed, 1 failed

Completed on the frozen first implementation at approximately 15:07 UTC. All seven exact pixel fixtures passed with zero visible differences: opaque 16 × 12, transparent 7 × 5, partial alpha 10 × 6, antialiased 15 × 13, palette 11 × 7, multicolor 19 × 11 and all-alpha sweep 256 × 10. Embedded output retained exact original bytes and verified zero. Negative control reported exactly one differing pixel; malformed output did not receive verification. File, dimension, animation and shape limits, cancellation, ZIP collision round-trip and geometry-only SVG validation passed.

The independent 96 × 96 silhouette has a curved hole, a separate island and a thin stroke. Its 384 × 384 target is sampled directly from the analytic shape rather than from either tracing algorithm. Error is mean absolute alpha-channel error at 4×, in 0–255 alpha units.

| Actual rendered output | 4× alpha MAE | Native differing pixels | Paths | SVG bytes | Components / holes |
| --- | ---: | ---: | ---: | ---: | --- |
| Pixel geometry reference baseline | 2.7148980034722223 | 0 | n/a | n/a | 2 / 1 |
| Initial VTracer silhouette | 3.00750732421875 | 466 / 9216 | 2 | 1418 | 2 / 1 |
| ImageTracer silhouette (initial fallback experiment) | 1.7295464409722223 | 424 / 9216 | 2 | 716 | 2 / 1 |

The first silhouette result **failed** the quality gate: its error was 10.78% worse than pixel geometry. The ImageTracer silhouette result improved the same metric by approximately 36.29%, preserving the required topology and thin detail. The implementation is being corrected to prefer that measured route. The test threshold and independent target remain unchanged.

Opaque multicolor VTracer, general RGBA ImageTracer, forced VTracer-startup-failure fallback, fully transparent output, palette/soft-alpha reporting and worker cancellation all passed in this run. Native error remains explicitly reported even for smooth output; no approximation receives an exact badge unless the actual native comparison is zero.

## Remaining runtime gates

Rerun the frozen engine suite after the silhouette correction. Exercise real shared-sidebar import/reload/mobile/focus/download journeys and the preference-write error-retention regression. Run actual conversions through the final production asset layout for every retained engine, then verify the existing private Site after publication. These are not covered by the above storage-only or development engine checks.
