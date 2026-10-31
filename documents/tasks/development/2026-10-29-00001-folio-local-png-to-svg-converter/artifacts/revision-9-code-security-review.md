# Revision 9 — independent UI, shared AI and saved artwork review

Reviewer: `/root/ai_package_audit`. Date: 2026-10-31 UTC. Modes: GVR REVIEW ONLY + GVS bounded READ ONLY. Reviewed the GVR/GVS handlers and their code-reviewer/security-verifier profiles in full. The admitted revision-9 request, plan and corrections remain the authority.

## Verdict

**F12 and F13 are corrected in source; their native/runtime verification remains separately tracked.** No additional confirmed security defect was found in the reviewed SVG/persistence/UI paths. This is not an approval of the still-developing companion, an independent review of this reviewer's account code, or a live-account verification. The later bounded accessibility review records its own focus finding.

### F12 — medium — connection discovery could leave Settings permanently busy

**Initial evidence:** `src/ai/client.ts` original `getAiStatus` lines 69–72 had no request deadline. `src/components/AiSettings.tsx` disabled Connect while connecting and only offered Disconnect after a successful connection. A loopback service accepting a connection but never completing status headers/body left the app-owned connection attempt pending; closing/reopening Settings did not cancel it.

**Impact / requirement:** unrecoverable connection UI until reload; R28/T20/T23. Minimal correction was a bounded status request including body read, plus a cancel/retry path.

**Disposition: corrected in source during review.** Readback now shows `getAiStatus` lines 74–89 with `AI_LIMITS.statusTimeoutMs`, external abort propagation and clear timeout error; the bounded JSON reader cancels on abort. `AiSettings.tsx` line 17 exposes Cancel during connection, and `useAiSettings.disconnect` cancels and clears the attempt. Executors should retain the requested stalled-header/stalled-body regression and visible cancel/retry evidence. No runtime test was executed by this reviewer.

### F13 — medium — a valid renamed source can generate AI artwork but cannot save it

**Current evidence:** `src/ai/client.ts` lines 130–142 validates the actual original bytes with `inspectRaster`/JPEG inspection but discards the detected MIME. The Images caller in `src/App.tsx` line 675 supplies the existing file metadata's MIME. `src/components/AiSvgPanel.tsx` lines 93–96 saves `candidate.source.type`. `src/icon-collection.ts` lines 163–164 correctly rejects a PNG/WebP source whose detected MIME differs from the supplied source metadata.

**Reproduction by control flow:** import a static WebP whose filename/declared type is PNG, then open its Images AI action. The real byte inspection and browser decode can accept it and return a valid candidate. Save then supplies `image/png` for retained WebP bytes and fails with “The saved source format or dimensions do not match the artwork.” An accepted JPEG with an empty/unusual declared MIME can similarly fail the panel's MIME check after generation. The existing Icons conversion repairs its detected source MIME; the new Images path does not.

**Impact / requirement:** the explicit Images-to-AI-to-saved-library path fails after a successful generation for an input the new preparation path accepts. R24/R30/R31; T21/T22/T23.

**Smallest correction:** retain the actual-byte original MIME from preparation and use a retagged Blob containing the unchanged original bytes for candidate comparison/persistence. Do not label the normalized PNG attachment as the original format, replace original bytes with the re-encode, or loosen the store's format/dimension guard. Add a procedural renamed-WebP (and accepted empty-MIME source if supported) check covering preparation → candidate → save → reload with source byte equality.

**Disposition:** corrected in source on focused readback. Root's corrected `AiSvgPanel` lines 67–74 prepares and validates the original, detects the original byte signature, and retags an unchanged Blob before candidate comparison/save. The strict store guard remains unchanged. This was independently read; no browser reproduction or regression pass is claimed here.

### F13 regression follow-up

At the coordinator's explicit follow-up request, this reviewer changed role for a bounded test/helper assignment, creating `src/ai/source.ts` and `tests/ai-source-browser-check.ts`. This is disclosed implementation, not an independent review of that helper. Root has replaced the equivalent inline normalization with `normalizeValidatedAiSource(original, signal)` immediately after successful preparation; the integration call was read back.

The helper performs a strict PNG/JPEG/WebP signature check on the already-validated original and retags its exact bytes. The native-browser harness exports `runAiSourceChecks()` and covers a canvas-generated WebP declared PNG and one with empty MIME: actual attachment preparation, source normalization, real native pixel comparison, strict rejection of the incorrect source MIME, candidate save, database close/reopen, and exact original source/SVG byte retention. It uses unique `folio-ai-source-qa-` databases and no provider call. Unsupported native WebP encoding is a failed/unverified check, never a fabricated pass.

Focused TypeScript diagnostics for those two new files passed with `noEmit`; no files were emitted. The harness has **not been run in a browser by this agent**. Root owns native execution and final application wiring. No package/Git/build/browser/account action was performed for this follow-up.

## Reviewed boundaries and positive evidence

The focused security control families were OWASP ASVS 4.0.3 V5 (input validation/output encoding), V8 (data protection) and V12 (file/resource handling). This is scoped source review, not an ASVS conformance assessment.

| Actor / data | Permitted action | Enforcement inspected |
| --- | --- | --- |
| User-selected source image | Explicit AI transmission, review, optional save | `AiSvgPanel` captures a source/revision; no generation on import or render. `useAiSettings` does not contact loopback on app load. Current panel checks image/task capabilities. |
| Untrusted model SVG | Bounded geometry preview/export after validation | Shared `sanitizeSvg` rejects declarations/entities, script/events, foreign content, images, style and external references. Local gradients/clips resolve through validated IDs; output is reserialized and previewed in Blob-backed `img`, never injected markup. |
| Curated saved artwork | Preserve source/base; derive chosen color; export exact output | Additive v2 migration; source/base/output/metadata saved in one transaction; conversion revision rechecked before commit; independent saved source survives conversion removal. Folder removal reparents saved records. |
| Delayed conversion/AI/color result | Commit only to its captured owner/revision | Panel abort/sequence checks prevent late candidate adoption; current-icon revision checked by save; recolor and fidelity stamping compare expected saved revisions; explicit deletion is not undone by a late check. |
| Pairing token | Use only for chosen loopback connection | Fixed loopback URL, validated port/token, omitted cookies, redirect errors, schema-checked responses. Token lives in connection state; persisted preferences contain provider/model/effort/port only. |

Additional inspected behavior:

- Saved SVG `none`, alpha, inherited `currentColor`, gradient stops, transforms and immutable reset behavior are implemented deliberately. Color changes invalidate prior fidelity/count; native recheck writes only the same saved revision. Individual and ZIP downloads obtain the same current saved output Blob as preview.
- Trusted local embedded results use an exact-original-wrapper equality check and remain non-recolorable. Generic/AI saves cannot opt into that path.
- Existing HTML previews use `sandbox="allow-scripts"` without same-origin permission; no new raw model-markup injection path was found.
- App retains one shared tree/sidebar; conversion/saved controls stay in toolbars. Settings and Images AI use the shared native dialog, and App's modal aggregate suppresses file shortcuts. Actual visual layout, narrow-screen behavior and focus interactions still need browser evidence.
- UI distinguishes local companion connection, CLI ChatGPT status, text-test success and image-to-SVG generation. It does not claim that catalog discovery or a fixture proves the user's real account inference. Local persistence/clearing-data limits and explicit AI transmission are visible.

## Coverage and limitations

Read current `src/ai/useAiSettings.ts`, `fidelity.ts`, `client.ts`, `contracts.ts`; `AiSettings`, `AiSvgPanel`, `SavedIconsWorkspace`, `PngSvgWorkspace`, `Modal`; affected `App.tsx` paths; full shared SVG validator; saved-data schema, save/recolor/verification/delete/migration/projection paths and hook integration. Read `tests/saved-svg.test.ts` and `tests/saved-icons-browser-check.ts`, whose assertions cover hostile SVGs, paint semantics, actual v1 migration, deletion independence, transaction abort, stale revision protection, bitmap restrictions and exported byte equality. Test source is evidence of intended assertions, not a test pass.

The companion executor was still implementing. Only its public contracts/client compatibility and relevant test declarations were read; no independent companion security verdict is supplied. `worker/account.mjs`, `ProfileSettings.tsx` and account tests are explicitly excluded because this reviewer implemented them. Root assigned those to another reviewer.

No source edits, package operations, Git commands, builds, browser actions, credential access, live targets or runtime tests were performed in this review. Only this requested artifact was written. Root's later final-source/build/browser/real-account evidence must identify the actual delivered revision. Real user-host ChatGPT inference remains separately pending.

## Source receipt

These hashes identify the final files observed during this review, including the F12 correction. Active executors may change them after this receipt; changed findings need focused readback.

| File | SHA-256 |
| --- | --- |
| src/ai/useAiSettings.ts | `b17664dbf758005131ad82338f2755c2433614d4377407a12cc85db651d28617` |
| src/ai/fidelity.ts | `55b93e5293c2be7be3a2b33bc86862fdd57efa0f8d01b6489d7fa60aa0e8ee7a` |
| src/ai/client.ts | `e44c026826d056ed2bde6a9ca2620bae95493cea08c8a390563623ac10a2c317` |
| src/ai/contracts.ts | `af33e4c991966ead456539a053c8b9f74405956cb675b4af914d451f5fc345f8` |
| src/components/AiSettings.tsx | `f57e79335d73f9e69cc54b29d6390303253fcef216244cedc129c801ab0e2b42` |
| src/components/AiSvgPanel.tsx | `43c1db4620e40814dbd8b3fd0c7e2f70975fb60d94e556e82b2c8ad87f5359bd` |
| src/components/SavedIconsWorkspace.tsx | `2aa63a8b40809adba874f4bff8ee54128505c8ee98de1e66424de4ede088991c` |
| src/components/PngSvgWorkspace.tsx | `aff15043f8633ad86d30a6ead7df280708b4e470ca88d4c306aafbacb06367b3` |
| src/components/Modal.tsx | `b00aec8c2e5ff28d463f889800cf1cb3dbd3adc39c3a68def3e35e93e3581c10` |
| src/App.tsx | `5fb3064230c636e03792210965e729516054c28d81acd0334a983028fef16d2c` |
| src/saved-svg.ts | `96e8b13dd4ed11ab08526aa09bc4548c8a6fc7540a24f592734febaacd9262b3` |
| src/icon-collection.ts | `70a6ad7eb64abf1573d9e29affc718b38fdd64923353611e0757ba31eb3880cd` |
| src/icon-types.ts | `6a390c4bf28815199317c8bd74bcd6b80af1293e530ef4a66fe484c6d9368233` |
| src/useIconCollection.ts | `58c865a50c47c79b1016ce9a6ed96f92da52cc9b7c8222e6e981569d1f24c93b` |
| tests/saved-svg.test.ts | `58d66146b1b9d3af3af7dd726da113ad90cbc154bd00b6d905ba40882b4dfa54` |
| tests/saved-icons-browser-check.ts | `925b56ec6612349ffa8a2097ab238212da9eb5b1ae1a0931ee2ac968d2ffaced` |
