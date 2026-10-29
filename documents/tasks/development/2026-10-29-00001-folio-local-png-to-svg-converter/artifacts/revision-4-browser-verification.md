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

## Corrected engine — 28 passed, 0 failed

The final development engine run completed at **2026-10-29T15:15:14.816Z**. All 28 checks passed. The unchanged primary silhouette quality gate recorded pixel MAE 2.7148980034722223 and smooth MAE 1.7295464409722223, an improvement of **36.29423872424612%**. It preserved two components, one hole and the thin stroke. The retained output is ImageTracer silhouette profile 1, two paths and 716 bytes, with **424 / 9,216** native pixels differing. The second silhouette case blocked VTracer and observed zero VTracer starts, with the same measured improvement and retained details. The opaque VTracer route and forced opaque fallback also passed.

## Shared application journeys observed so far

- Canvas loose-file import added seven source Blobs and seven ready results automatically to Uncategorized. Repeating the input names retained both copies with safe suffixes; the actual app then held 14 ready records/sources/outputs.
- Sidebar directory drop captured the real app's synchronous directory getter, drained multiple `readEntries` batches and imported three PNGs into QA Icons/Nested/Deeper while retaining Empty. The non-PNG readme produced an explicit skipped notice. The synthetic helper's browser prototype method was restored immediately after dispatch.
- Canvas import of duplicate directory roots retained independent QA Icons, QA Icons (2), QA Icons (3) trees. A user-named Uncategorized directory became Uncategorized (2), distinct from the permanent default. A real iframe reload reopened all **24 icons**, folders, sources and results. This was a full document replacement, not a Vite hot update.
- A PNG dropped while HTML was active selected Images, its imported file and `#images` consistently. A separate test delayed the actual Library write with a bounded, no-data-change IndexedDB transaction, clicked the actual Icons tab, released the writer and verified that completion preserved `#icons`, the Icons canvas and the previously selected icon. Library data still saved successfully.
- A native source-transaction abort rejected intake without adding a partial icon. Its error remained visible after subsequent zoom/background preference saves. A successful explicit import cleared the error and saved the 96 px silhouette as item 25.
- Selecting Smooth curves reconverted that saved silhouette and showed 424 differing pixels, two paths, 716 bytes and the actual ImageTracer silhouette identity. Original and SVG previews were both 384 × 384 at 400%.
- The real individual download anchor supplied `qa-synthetic-silhouette-96.svg`, **716 bytes**, exactly matching the saved revision-2 output. The actual ZIP anchor supplied `folio-icons.zip`, **54,079 bytes**, with all **25** allocated SVG filenames and byte-identical saved entries. The observer preserved the original anchor click and restored itself. Browser/OS delivery of the files remains unobserved; this establishes payload correctness.
- At a 390 × 844 iframe viewport, document scroll width and canvas width were 390 pixels. Previews retained their intentional 384-pixel image width inside scrollable surfaces. The same mobile file drawer opened, searched for the silhouette, and Escape closed it, removed main inertness and returned focus to Toggle file sidebar. Search and Favorites narrowed the shared tree to the same selected silhouette, and Move to folder moved it into QA Icons while preserving the favorite.

The initial directory harness used an expando on a native DataTransferItem wrapper that was not retained when reread by the iframe. That test-helper failure was corrected with a bounded iframe-prototype bridge and an explicit captured-root receipt. A second helper-only issue used `crypto.randomUUID` on the HTTP preview origin; it now uses the existing HTTP-compatible identity helper. No production drop code was changed to satisfy either harness correction.

## Keyboard and deletion completion

Actual keyboard focus was placed on the batch Stop button with 15 items pending. After automatic completion removed it, focus was on the persistent Conversion mode select. A second keyboard Stop invocation left 52 ready outputs and 21 cancelled records out of 73 originals; cancelled inputs remained saved. A browser input timeout was followed by fresh state observation rather than a duplicate action.

Folder-removal Cancel returned focus to its original Remove QA Icons (3) button. Confirming removal of that procedural folder closed the dialog and returned focus to the Icons tab. Removing the only selected search result likewise returned focus to Icons (69 records); the removed invoker was disabled, and no dialog remained. These are observed normal and disabled-invoker branches, not a claim about every hypothetical keyboard combination.

## Exact production asset execution

The managed preview was switched from Vite to a self-contained QA server serving the exact packaged frontend manifest bytes. The separate procedural harness was prebundled outside the production asset inventory. The application document visibly loaded `/assets/index-D8MZ5ixK.js`. The first shim launch failed because an absolute sibling-checkout path was not mounted in the managed preview; a self-contained shim resolved that environment issue without changing application code or preview permissions.

Actual saved conversions through the production UI:

| Input / route | Actual engine | Result |
| --- | --- | --- |
| Opaque 16 × 12, Smooth | VTracer 1.0.0-alpha.4 / browser 0.0.3 / profile 1 | 3 paths; 0 / 192 different |
| Partial alpha 10 × 6, Smooth | ImageTracer 1.2.6 / RGBA profile 1 | 49 paths; 54 / 60 different, explicitly approximate |
| Analytic silhouette 96 × 96, Smooth | ImageTracer silhouette profile 1 | 2 paths; 716 bytes; 424 / 9,216 different |
| Same silhouette, Pixels | Exact pixel rectangles 1 | 462 rectangles; 0 / 9,216 different |
| Saved alpha sweep 256 × 10, Pixels | Exact pixel rectangles 1 | 2,550 rectangles; 230,944 bytes; 0 / 2,560 different |

At 200%, both silhouette previews measured 192 × 192. At Fit, both measured 96 × 96. In the 390-pixel viewport at 400%, both surfaces measured 343 × 270 with a 416 × 416 scrollable stage. Keyboard PageDown in the original surface moved both scrollTop values to the same nonzero value (9 at the observation), demonstrating the scroll synchronization path.

### Interrupted queue recovery — failed mixed-client trial retained, isolated trial passed

The first production reload trial on the shared development origin ended with 5 ready and 19 worker-start errors from a new 24-file alpha-sweep batch. Every original remained saved. The generic message is emitted only by the pixel Worker `onerror` path. Independent source diagnosis found no inconsistent production asset path or deterministic geometry failure. Older development app tabs/frames were still open on the same origin and could claim jobs using their retained Vite worker URLs after the origin switched to production assets. This is a supported hypothesis, not a proven failing-URL capture; no worker error URL was captured from that trial.

All other agent-owned development tabs/frames were then closed. The user's separate original Site tab was not touched. Retrying the same saved failed source succeeded with zero differences. The next trial began with 93 existing records (55 ready, 18 prior errors, 20 cancelled), imported 24 new alpha-sweep files, and observed **117 saved / 23 converting** before a real iframe document reload. After reload it observed **20 converting**, without clicking Retry. The app continued while HTML/Images navigation was exercised.

The final read-only saved-record receipt identified the new batch by IDs absent from the pre-import snapshot: **24 new records, all ready, all 24 with zero differing pixels**. The app held 117 original Blobs and 79 output Blobs; the prior 18 failed records and 20 cancelled records remained unchanged. This establishes automatic recovery through the actual production React app, not only the store's claim API. It does not turn the earlier mixed-client failure into a pass or claim cross-version worker compatibility.

### Reverse Library import

With Images selected, the procedural harness delivered a 701-byte ZIP containing one HTML page and linked CSS through the real canvas drop. The actual app persisted the HTML record, selected HTML, changed the hash to `#html`, and selected the same saved ID in the shared tree and filename toolbar. The Icons canvas was absent. The harness receipt `Library Images-to-HTML ZIP import keeps navigation coherent` passed. Combined with the earlier HTML-to-Images and delayed-import-after-Icons-navigation checks, both directions requested by the independent review are now observed.

## Remaining release gate

The exact production frontend and all retained engine routes have executed. Publication to the same owner-private Site and a fresh connected-browser smoke check remain pending at this checkpoint.
