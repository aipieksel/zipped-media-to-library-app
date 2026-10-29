# Independent implementation review

Reviewer: `/root/fidelity_research` (GVR; independent of `/root` UI implementation and `/root/converter_engine`). Reviewed 2026-10-29 against plan revision 2. Checkout HEAD at initial review: `dec0cda5102f62163431687639cae59ab40e90cc`; application changes were partly staged/uncommitted, so file hashes below bind the actual reviewed source.

Initial verdict: **changes requested for CR1 (medium)**. No critical/high finding was identified. Browser evidence remains a separate root-owned gate; this static review does not approve pixel fidelity or rendered interaction by inference.

## CR1 — medium — source preview bypasses PNG allocation validation

File: `src/components/PngSvgWorkspace.tsx`, initial addFiles sourceUrl assignment (line 148) and Original PNG preview image (line 278).

The import path creates a Blob URL immediately after checking only the filename/MIME and compressed file size. The newly selected item renders that URL in an image before `convertPng` has completed `inspectPng` and native dimension validation. An oversized PNG with a small compressed payload can therefore reach the browser decoder through the preview even when the conversion engine subsequently rejects its IHDR dimensions. Invalid/animated inputs can similarly be rendered outside the declared static conversion guard. This undermines the planned validation-before-allocation boundary.

Smallest fix: expose the source preview URL only after structural/dimension validation has succeeded. The current `converting` progress event occurs after `decodePngPixels` finishes, so a job-identity-guarded callback at that point can create the source URL lazily. Keep rejected/unsupported inputs without an image source. Test an oversized-header and invalid PNG via the actual UI, confirming no preview image is installed before rejection. Do not merely hide the image visually while retaining its src.

Status: open at initial review; sent to root before finalizing this artifact. Implementation owner repairs; reviewer does not edit source.

## Other reviewed boundaries

- Queue progression uses one pump, one active job identity and AbortController. Progress/result/catch guards correctly prevent an old conversion from overwriting a removed, cleared, cancelled or retried item. Retrying the same item while its prior promise settles leaves queued state intact. Switching workspace retains converter state while preventing library drop/key handlers from receiving its actions.
- PNG metadata checks signature, header dimensions, valid color/depth combinations, chunk bounds/order, palette presence, image/end markers, animation and unknown critical chunks. Full PNG CRC validation is delegated to the browser decoder rather than implemented here; the inspector should not be described as full PNG conformance validation.
- Integer horizontal runs/vertical identical-span merging are non-overlapping. SVG fills preserve exact normalized alpha values, dimensions and raw pixel-grid geometry. Transparent RGB is intentionally ignored only at alpha zero. Raw byte comparison, no thresholding, independent actual-SVG rendering and truthful unavailable/different statuses match the reviewed design.
- Embedded mode uses original input bytes, not canvas re-encoding. Verification, preview and downloads all consume the same generated SVG string; markup is ASCII and output byte accounting therefore matches string length.
- Worker, FileReader and image lifecycles have abort/error/timeout cleanup. Temporary object URLs and canvas stores are released. Per-file limits and source/session-output caps are enforced; ZIP generation is serialized. These payload budgets do not certify total process heap usage.
- File names are safe flat NFC/case-normalized allocations with deterministic suffixes and reserved-name handling. ZIP creation revalidates uniqueness and path restrictions. Download URLs expire and are revoked on unmount.
- The App diff is scoped to navigation, workspace conditionals, shortcut gating and help copy. Library state, ItemKind, database schema, cloud endpoints, capture implementation and existing preferences are not modified. The library view is unmounted while its App state is retained; iframe-internal runtime state is not preserved, which is outside the stated selection/preferences contract.
- No runtime dependencies were added. Existing JSZip is reused. Fixture PNGs are generated procedurally, including a true two-bit indexed PLTE+tRNS fixture, antialiased coverage and a 256-level alpha sweep. Node tests independently reconstruct rectangle coverage, check hidden RGB/different-alpha rules, compare embedded bytes and ZIP contents, and test malformed/bounds/naming cases.

## Coverage and remaining runtime evidence

Read all four src/png-svg modules, PngSvgWorkspace.tsx, png-svg.css, App.tsx diff, tests/png-svg.test.ts and tests/png-fixture-generator.ts. Inspected related source handlers and privacy/configuration files. Read-only shell checks: git diff/status, source reads, targeted dependency/sink searches and SHA-256 hashes. No build, test suite, browser, network probe or source mutation was performed during this review.

Root reports initial 19 converter Node tests and TypeScript checks passing; those results are not rerun or independently certified here. T4 requires actual positive raster matches for all six classes and embedded partial alpha, plus a one-visible-pixel negative case. T3/T5/T6 still need observed stop/remove/retry/clear, navigation/selection retention, no converter file traffic, downloads, mobile layout and keyboard behavior. Read the resulting evidence before final acceptance.

## Initial reviewed source hashes

| File | SHA-256 |
| --- | --- |
| src/png-svg.ts | `e406285f9a947e8b9dec6a78d92b3a0c38d22d363404ad95311f7e87d2d45f3c` |
| src/png-svg-browser.ts | `f13182d83269a4ccdc98b77b6285e24e4814eed86950ee7ef1b5d0e786f265e2` |
| src/png-svg.worker.ts | `dfcc0a77887594ed42894504720e0ba4cc4f5ad1f99eaf9fa0a1d50e5e2ebbfc` |
| src/png-svg-download.ts | `90e65a69e58bee08f2610882db7c6389d3faac7fbb4794fbca2f8721e89bed76` |
| src/components/PngSvgWorkspace.tsx | `3e58e8f73b8c43b57afdc67fd9c4307959811f76646ee17761a2b2ef29f33705` |
| src/App.tsx | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| tests/png-svg.test.ts | `8f00a0c4a0cc98203c96ef7fd6c9f27c63272e953d134095ed195c65831caf9c` |
| tests/png-fixture-generator.ts | `b5efb9d8a5d62ee8f3fabfd2de9b2965f50efff9435e71c0f0ab264c1be8a444` |

## CR1 repair readback

Reviewer `/root/fidelity_research` inspected the actual repair. **CR1 resolved in source. Static code-review verdict: approved; no open material findings.**

`addFiles` no longer creates a source image URL. In the guarded active-job progress callback, the URL is installed only for `stage === 'converting'`. `convertPng` emits that stage only after `decodePngPixels` reads bounded bytes, calls `inspectPng`, performs native decode/dimension validation, and checks cancellation. The callback also verifies mounted state, active job identity, abort state, item identity and processing status before exposing the image. Existing validated source URLs are reused on retry; removal/unmount cleanup remains intact. The underlying File is immutable, so reusing its already validated URL introduces no different-byte validation gap.

Updated `src/components/PngSvgWorkspace.tsx` SHA-256: `d29511e97c57a314734a6ab254bbd0b379df462cdd6f8ededbf7b7fe1d4b196b`. `src/png-svg-browser.ts`, `src/png-svg.ts` and `src/App.tsx` hashes are unchanged from the initial review.

Root reports 180 passing executed tests, zero failures, one skipped optional absent-fixture test, and passing TypeScript checks; these are reported evidence rather than tests rerun by this reviewer. Root also reports the first browser batch converted all seven procedural fixtures and the opaque preview displayed 0/192 differences. Comprehensive browser harness and remaining interaction/privacy checks are still pending; this static approval does not certify those results. Retain a focused oversized/invalid preview regression in the actual UI evidence.
