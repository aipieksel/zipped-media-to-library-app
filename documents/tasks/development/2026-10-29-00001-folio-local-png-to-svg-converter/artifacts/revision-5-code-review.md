# Revision 5 — independent classifier and warning review

Reviewer: `/root/fidelity_research`. Reviewed **2026-10-29 16:17 UTC**. Implementation owner: `/root/converter_engine`; coordinator: `/root`.

**Verdict: approved for the inspected source scope. No unresolved high- or medium-severity finding.** This verdict does not approve pending test results, prove improved browser rendering, or claim the unavailable private source now meets the classifier.

## Scope and immutable comparison

The review covers only the production diff in `src/png-svg-trace.ts` and `src/png-svg-browser.ts` against commit `54600fb`, with the admitted revision-5 plan and test contract. The two baseline files have no difference between `7ea954a95a2bb0164ea8bb15910bcc1111c120e3` and `54600fb`. The existing baseline file hashes also match those inspected during the plan review.

| File | Baseline SHA-256 | Reviewed repair SHA-256 |
| --- | --- | --- |
| `src/png-svg-trace.ts` | `70f0dea9985bb7426867cd625ceffe432127e66bbb1fdf109d82a19ff7cc7d00` | `61f64f3714560ee765781d32302a4ad76b225c1428b49c45ef0731ade6d6adae` |
| `src/png-svg-browser.ts` | `d7b50c564f7b4184a189afe7f00da54f023d6ad880794ba7b36163553a5b9dd3` | `2b89be493cf24ca0dee2100d8af54d68d1ff1d11ca6a529e24261ecf07a81adf` |

The source hashes were independently read at **2026-10-29T16:17:07.292585Z** and equal the implementation owner's announced frozen hashes. The reviewed plan remains `fix-plan.md` SHA-256 `d38d1b06f1abc6506b1e63bd2990c6323267b4b2395bafd8f104e19da1d52ebe`, with `test-plan.md` SHA-256 `c6d4485fb466088c98094825be0d31467a202504a1454e7d1176128cef871711`. The finalized record at this read has SHA-256 `78dbbf81bfb3e3cd7bdb2c38604612629ba75e0271a9d669f4c5818f43c0b5ec`.

No application, test, plan, dependency, build or browser mutation was performed by this reviewer. No test or conversion was executed. Read-only Git comparison and whitespace-diff inspection were used; the only written file is this report. The test owner was still adding negative/browser checks at assignment time, so those evolving files are outside this frozen source verdict.

## Directed support search

`alphaSupportDistances` implements the admitted multi-source capped search correctly on source inspection:

- For opaque support, every alpha-255 pixel starts at distance zero. Expansion admits only a neighbor whose alpha is less than or equal to the current alpha. Reversing such a path from the partial pixel to its opaque seed is nondecreasing, as required.
- For transparent support, every alpha-zero pixel starts at distance zero. Expansion admits only equal or greater neighbor alpha. Reversing the path toward its transparent seed is nonincreasing.
- Out-of-canvas transparency is represented by seeding a nonzero border pixel at distance one, after all zero-distance seeds. Corners and single-row/column overlap cannot create duplicate queue entries because a seed is accepted only while unreached. This matches one eight-neighbor step to the exterior.
- Zero-distance seeds precede all distance-one border seeds; subsequent expansion appends to the same FIFO. Every first visit is therefore a shortest valid path in the directed unweighted graph. Border seeding cannot preempt a shorter-than-one nonzero-pixel path.
- Distance-three entries do not expand. Only distances zero through three are queued; four is an unreached sentinel. The final checks apply only to partial-alpha pixels and reject any unsupported one.
- Bounds checks prevent row wrap or off-canvas reads. Each accepted node is marked before enqueueing, so a pixel enters the count-sized queue once. The queue cannot exceed `width × height` entries.

The monotone condition matters for the planned negatives. An opaque-root search can reach a transparent gap but cannot then climb from zero into a detached partial-alpha island. A transparent-root search cannot climb through an opaque enclosure and then descend into a partial-alpha pocket. These are source-level consequences of the inequalities; the planned fixtures still need their execution evidence.

Validation precedes allocation and retains the 262,144-pixel / 1,024-side smooth limit. Each search allocates a one-byte distance map and a four-byte queue per pixel; two complete searches allocate at most 10 bytes per input pixel in total, at most 2.5 MiB under that limit, excluding pre-existing image/tracer buffers. Each pixel has at most eight neighbor inspections and is queued once. This establishes the intended linear work/allocation bound, not a timing benchmark. Early guard failures avoid these searches.

## Guard preservation and diagnostics

The implementation retains the same prerequisite counts and foreground comparison:

- At least four fully opaque pixels, at least one fully transparent pixel, and at least one partial-alpha pixel.
- The first opaque pixel supplies the foreground RGBA reference.
- Each visible pixel retains the same three channel checks, `abs(channel − foreground) × alpha <= 384`; hidden RGB under alpha zero remains ignored.

The old combined null return is replaced with a discriminated analysis result containing either the existing `SilhouetteInfo` or one bounded reason. `detectSilhouette` remains a compatibility wrapper over the same analysis, so eligibility-only callers do not acquire a second classifier implementation.

The reason strings correspond directly to the actual rejection branches: insufficient opaque core, no transparent background, no partial edge, foreground-color mismatch, failed opaque support, or failed transparent support. The public message function maps only these known enum values to static text. It does not include pixels, coordinates, names, histograms, image subject, or a claim about the artist's intent.

`generateSmoothSvg` performs the analysis once. It emits the reason only when silhouette eligibility failed and the source is not fully opaque, which is the branch selecting general RGBA tracing. Fully opaque inputs retain VTracer handling and the existing truthful fallback warning; they are not mislabeled with an RGBA eligibility reason. Successful silhouette classification receives the revised three-pixel-support explanation. Actual engine identity still comes from the route that returns the normalized SVG.

The silhouette identity changes from `1.2.6 / silhouette profile 1` to **`1.2.6 / silhouette profile 2`**. The VTracer and general ImageTracer identities remain unchanged. This correctly distinguishes the broader eligibility policy in saved provenance without pretending the third-party dependency itself changed.

## Unchanged fidelity, privacy and runtime boundaries

The diff leaves the alpha-128 mask threshold, foreground restoration, ImageTracer curve/palette options, SVG path validation, output limits and all third-party versions unchanged. It does not add a palette adjustment, residual layer, bitmap in smooth output, or user control.

The exact-pixel and embedded branches are unchanged. `verifySvgPixels` still renders the exact generated/downloadable SVG at native dimensions and compares it against the retained decoded source; only a zero differing-pixel count is verified. The returned byte count, browser/time/color-space provenance and warning collection are unchanged. The classifier reads the source buffer and creates only distance/queue arrays; it does not rewrite source pixels or the comparison reference.

The worker transfer still uses `pixels.slice()` so the reference is retained. The existing cancellation checks, one-settlement cleanup, worker termination, 45-second timeout and normalization remain in place. The synchronous eligibility pass is bounded by the existing input limit; no unbounded traversal or new asynchronous race is introduced by this diff.

No new fetch, URL, worker endpoint, telemetry, storage operation, downloaded artifact, or markup insertion is introduced. The local diagnostic is a static string added to the existing result warning array. Existing source/privacy isolation is not widened. No dependency, license, build asset or server change is part of these two-file repairs.

## Findings and remaining evidence

**Concrete source findings: none requiring repair.** The change implements the admitted radius-three monotone policy, preserves the strict exactness contract, and exposes actual bounded guard outcomes.

The policy remains a heuristic: a narrow intentional translucent pattern can be indistinguishable from a narrow coverage fringe. The source does not and cannot establish universal semantic classification or exact smooth reconstruction. The plan's RGBA rejection cases, approximation warning and strict native count remain necessary boundaries.

The coordinator reports that the previously red procedural fixture is now accepted, with ten focused cases and scoped TypeScript passing in the implementation owner's run. These are attributed reports, not independently executed evidence in this review. The completed negative reason assertions, broad-fade/pocket/island and angular-detail regressions, unchanged original quality gate, new independent 4× rendering gate, fresh native recount, and final production execution still require their actual results. This source approval must not be used to infer those pending outcomes or a successful repair of the user's unavailable input.
