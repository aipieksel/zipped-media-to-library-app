# Revision 4 — independent code, security and accessibility source review

## Review identity and scope

- Reviewer: `/root/fidelity_research`, independent of the application, storage/controller and converter implementations. This reviewer previously researched candidates and authored the development-only collection harness; that harness is not treated as independently executed evidence here.
- Requested stages: GVR, GVS and the static portion of GVA. The selected handlers and their code-reviewer, security-verifier and accessibility-verifier profiles were read.
- Record: existing PNG-to-SVG task, revision 4. No new workflow record or metadata mutation.
- Snapshot receipt: **2026-10-29 15:01:46 UTC**. Implementation was still receiving focused changes during review. Hashes below identify the working-tree receipt, not an immutable release approval. Each repaired finding needs focused readback.
- Initial authority: read-only source inspection, with this artifact as the only permitted write. A later explicit coordinator assignment authorized preparation of `THIRD_PARTY_NOTICES.md` from pinned official sources to address R4-C2. No application/test edits, installs, builds, Git commands, browser control or live security probes were performed in this review assignment. Public package archives were inspected as data for the notice follow-up; no downloaded source was executed.

**Current verdict: approved for the bounded source-review scope after repairs.** All six reported findings are resolved at source level in the 15:15 UTC readback below. No unresolved high or medium source finding remains in the reviewed paths. No critical security vulnerability or icon exfiltration path was found. This is not release approval: final browser quality, production asset execution, actual keyboard/mobile behavior and the final build/privacy gates remain the coordinator's verification responsibilities.

## Findings

### R4-C1 — High: Library import completion can disagree with the selected top tab

**Files:** `src/App.tsx`, `importFiles` completion, `switchTab`, top workspace navigation.

**Requirements:** R15, R23; T3/T6.

The existing import completion updates `kind` with `itemKind(firstNew)` but does not update the new independent `tab` state or URL hash. The top selected tab uses `tab`, while the Library canvas/tree use `kind`.

**Concrete source-level reproduction:** begin in HTML, use its existing importer to import a loose PNG, and let the import complete. The completion sets `kind` to `image` and selects the new image, while `tab` remains `html`. The reverse occurs when the first new item is HTML while importing from Images. This is introduced by separating top navigation state from the pre-existing file-kind state.

**Required correction:** keep tab, file kind, selection and hash coherent when an import is still the active navigation context. Use an explicit current-tab/navigation-generation guard so a Library import finishing after the user opens Icons or another section does not steal that section. Use Library-specific state setters in the Library import path rather than a section-dependent alias.

**Required verification:** actual HTML-to-image import, Images-to-HTML import, and an import completing after switching to Icons. Verify top selected tab, sidebar kind, selected file, canvas and hash together. Source correction alone does not establish the asynchronous journey.

**Status:** resolved-static in the 15:05 UTC readback; actual asynchronous import journeys remain required.

### R4-A1 — Medium: automatically disappearing batch Stop control loses keyboard focus

**File:** `src/components/PngSvgWorkspace.tsx`, conditional batch Stop button.

**Requirements:** R5, R16; T3/T6.

The batch Stop control is rendered only while `pending > 0`. Its click handler moves focus to the persistent Mode select, but no corresponding protection runs if the last job finishes/errors automatically or is cancelled in another tab while the button owns focus. Removing that focused node leaves keyboard focus without a useful successor.

**Required correction:** track whether the disappearing batch control owns focus and transfer focus to a stable nearby control when it vanishes. Do not move focus if the user has already moved elsewhere. The selected Stop/Convert again branch reuses its button position, so this finding specifically concerns the conditional batch control.

**Required verification:** focus batch Stop without activating it; let the last job finish and separately fail/cancel. Check the actual focused element. Repeat while focus is elsewhere to prove no focus stealing.

**Status:** resolved-static in the 15:05 UTC readback; actual completion/error/cross-tab focus behavior remains required.

### R4-A2 — Medium: two new normal-size text colors are below 4.5:1

**File:** `src/components/png-svg.css`.

**Requirements:** R5/R16; static GVA, with browser presentation still separate.

Direct calculation from the current CSS sRGB colors gives:

| Selector | Foreground | Background | Contrast |
| --- | --- | --- | --- |
| `.icon-verification-context` | `#707b6b` | `#ffffff` | 4.436:1 |
| `.png-preview-placeholder` | `#66735c` | `#edf0ea` | 4.375:1 |

Both selectors use normal-size text. The existing `var(--muted)` (`#626c69`) is a compatible correction; it computes to 5.429:1 on white and also exceeds 4.5:1 on the preview surface. These are static color calculations, not a claim of full visual or assistive-technology conformance.

**Status:** resolved-static in the 15:05 UTC readback; both selectors use the existing muted color.

### R4-A3 — Medium: icon/folder removal can return focus to a soon-deleted control

**Files:** `src/App.tsx`, `Modal` cleanup and the `iconRemove` confirmation.

**Requirements:** R5, R17/R19; T3/T6.

Confirming removal immediately closes the dialog, then starts the asynchronous icon/folder mutation. The generic Modal cleanup returns focus to its initiating control. For folder removal that control is in the tree row that is subsequently deleted; for the last selected icon the persistent Remove action subsequently becomes disabled. The existing fallback targets `.settings-button`, which is absent from Icons.

**Required correction:** restore to a stable post-removal location, such as a surviving neighboring tree row or the persistent selected Icons tab/import/Mode control. Preserve focus ownership across the asynchronous mutation and avoid restoring focus after the user has deliberately moved elsewhere. The fallback must remain usable in Icons and with an empty collection.

**Required verification:** remove a folder using only the keyboard; remove the last selected icon; cancel the same dialogs; confirm a failed deletion does not strand focus or hide the error.

**Status:** resolved-static in the 15:05 UTC readback; actual keyboard removal/cancel/failure journeys remain required.

### R4-C2 — Medium: distributed tracer notices are incomplete in the inspected build inputs

**Files:** `scripts/vtracer-assets.ts`, `node_modules/vtracer-browser/LICENSE`, selected dependency/build inputs.

**Requirements:** R12/R21; T6/T7.

The asset plugin publishes the browser wrapper's LICENSE, containing its 2026 zxdstyle notice. The WASM also contains upstream VTracer/VisionCortex code, and the accepted research explicitly calls for the applicable upstream notices. No corresponding third-party notice artifact was found among the inspected source/build inputs. ImageTracer's notice should also remain available with its distributed code.

**Required correction:** collect the applicable notices for the exact pinned upstream code and distribute them with the tracer assets. Use text source/build assets; no privacy exemption for binary repository contents is needed.

This is a concrete packaging evidence gap, not a legal certification or an assertion about uninspected transitive licenses.

**Status:** resolved-static in the 15:15 UTC readback. The authorized notice artifact is present and the executor's Vite asset map includes it in development and production output. Final built/deployed asset delivery remains a runtime/build gate; this is not legal certification.

### R4-C3 — Medium: automatic preference writes can clear an unrelated failed-import error

**Files:** `src/useIconCollection.ts`, `mutate`/`setPreferences`; `src/App.tsx`, debounced icon preference persistence.

**Requirements:** R5/R19; T2/T6 failure visibility.

Every successful `mutate` calls `setError('')`, and `setPreferences` uses that same wrapper. App automatically writes selection/expanded/order after 300 ms. A failed source intake can therefore show its error and then lose it to an unrelated automatic preference write. A concrete affected sequence is dropping into a no-match/Favorites view: the drop clears filters, selection changes, preference persistence is scheduled, and an aborted intake has no failed icon row to retain its error after the banner is cleared.

**Required correction:** successful preference/background persistence must preserve an operation error. Clear the error on an appropriate explicit recovery or successful user operation, rather than an automatic settings write. Keep preference-write failures visible as well.

**Required verification:** inject a source transaction abort while a view/selection change also schedules the debounced preference write. The failed-import banner must remain available after the delay, and raw storage must still contain no partial intake. An actual successful retry may clear it.

**Status:** resolved-static in the 15:15 UTC readback. Preference failures/success use a separate channel and cannot erase the operation error. The actual source-abort plus later preference-save UI check remains required.

## Source findings that support the intended design

### Shared workspace and collection isolation

- `App` renders one sidebar and one `ArchiveTree` call. Icon metadata is projected into the existing tree shape; search, Favorites, ordering, folder controls, mobile drawer and resizer use that same owner.
- `ItemKind` and the existing HTML/image persistence and cloud APIs remain separate from the Icons collection. Icon branches use `useIconCollection`; individual Icon downloads read the saved output Blob rather than entering Library download APIs.
- Icon original/result Blobs live in distinct IndexedDB stores. `snapshot()` returns metadata, folders and preferences, and preview/download reads request individual Blobs lazily.
- Source intake writes folders, original Blobs, queued metadata and associated preferences in one transaction. Result completion writes output and ready metadata in one transaction. The write wrapper awaits successful commit before announcing and consumes transaction rejection after failure.
- Folder parents and source-root keys distinguish duplicate imports; loose PNGs use the permanent reserved folder. Source paths now retain literal composed/decomposed Unicode identity, while display/export allocation applies NFC/case collision checks. A source-level Unicode regression was inspected; an actual persisted Unicode-sibling browser case has not been observed here.

### Queue, revision and resource boundaries

- Claim creation is a read/write transaction with one live claim across the local collection. A claim carries ID, revision, owner, token and expiry; heartbeat, completion and failure check current ownership and expiry. Release checks owner/token/revision before requeueing.
- Retry/cancel/delete prevent obsolete completions from restoring an old result. Retry removes the old output; delete removes metadata/source/output; cancellation retains a source for explicit retry. A second opening does not indiscriminately reset live claims.
- The controller uses one active conversion, metadata broadcasts and periodic metadata refresh to recover expired foreign work. Worker cancellation/timeout calls `terminate`; ImageTracer receives a transferable copy, and the pinned VTracer wrapper itself copies RGBA before transfer.
- Intake bounds include 100 accepted PNGs/100 MiB per import, 5,000 discovered entries, depth 32, and path length 2,048. PNG byte/native-dimension bounds are checked before browser decoding. Smooth work is bounded to 262,144 pixels/1,024 per side, 20,000 paths/200,000 segments and per-engine timeouts. SVG output is bounded to 24 MiB; ZIP admission/readback is bounded to 128 MiB.
- These are source bounds, not measured peak-memory or worst-case latency results. Browser quota remains the persistent collection limit.

### Fidelity and generated SVG safety

- Exact mode still merges non-overlapping same-RGBA integer pixel rectangles. Transparency is represented with fill opacity; fully invisible source pixels are omitted. The original decoded reference remains available for the independent render comparison.
- Embedded mode uses original PNG bytes in a data URI with explicit dimensions. It is visibly described as a bitmap inside SVG.
- Native verification rasterizes the exact generated SVG string separately at original dimensions. The comparator treats only RGB hidden by zero alpha on both sides as invisible; all other channel differences contribute to the differing-pixel count. Zero-only verification has not been relaxed for smooth mode.
- In the final reviewed routing, smooth mode sends fully opaque artwork to VTracer and both general alpha-bearing artwork and the narrow silhouette/mask route to ImageTracer. The former VTracer binary silhouette route was removed following the recorded quality failure. The code discloses the approximation and reports the actual retained engine/fallback. This source inspection cannot establish curve quality or classifier adequacy on real art.
- Traced SVG is parsed and reconstructed from a small allowlist of vector elements, numeric path/transform data, literal fills and bounded opacity. External paint references, image/script/foreign content, event attributes and unsupported declarations are rejected. It is displayed through a Blob-backed image, not inserted as HTML.
- Saved result metadata includes exact output byte size, engine identity/version and historical check time/browser/sRGB RGBA8 context. The UI labels the check as saved and states browser/color-profile limitations.

### Privacy and downloads

| Surface | Reviewed control | Scope of conclusion |
| --- | --- | --- |
| Local PNG/file paths | Signature/structure/dimension checks, literal relative-path validation, bounded traversal | No arbitrary path is used to read server files or construct remote conversion requests |
| Icon persistence | Isolated local IDB module with no Library/cloud dependency | No icon upload call found in the inspected path |
| Generated markup | Numeric/literal allowlist and safe reserialization | No raw traced markup insertion or external-resource reference accepted by the normalizer |
| Download names | Source-based safe allocation plus independent ZIP name validation | Case/NFC collisions, traversal separators and unsafe names are rejected/resolved |
| Runtime engines | Pinned local entry/worker/WASM assets, narrow asset-copy map | No CDN or external conversion endpoint appears in the new runtime path |
| Source repository | Existing code/text privacy index checker remains present without a broad exemption | A fresh Git index gate must still be executed by root; this reviewer did not run Git |

Preview URL effects release previous URLs on selection/revision change and unmount, and guard asynchronous loads after cleanup. Original and SVG planes share one integer size, image-anchored checker backgrounds and synchronized scroll offsets; original pixel inspection is explicit. Actual rendered alignment/panning still needs browser inspection.

## Accessibility review boundary

The latest top navigation source has roving tab stops and Left/Right/Home/End handling. Native selects have labels; toggle controls expose pressed/selected states; shared focus-visible rules cover the new controls. The mobile sidebar uses the established hidden/visible surface, focus handling and inert main content. No separate hidden converter workspace retains tab stops.

The reported focus and contrast findings are resolved at source level in the readbacks below. This review did not operate a screen reader, browser keyboard, pointer, mobile viewport or browser page zoom. It does not establish formal WCAG conformance. Root owns actual keyboard/mobile checks and the results must distinguish browser evidence from this source inspection.

## Required runtime evidence before release

1. Execute the 13 isolated collection browser checks, including real source/result transaction aborts and competing owners. Record the actual report; test source existence is not a pass.
2. Complete actual shared-tree import/reload/delete/mode/switch journeys, including R4-C1's existing Library regression scenarios and the focus cases above.
3. Execute the strict native PNG categories and negative control against final engine code. Confirm saved output/ZIP bytes match the checked/displayed result after reload.
4. Satisfy the independent 4× curved-silhouette/hole/thin-detail quality gate for the retained smooth route; native nonzero honesty alone does not meet that gate.
5. Run both retained engines from the final production worker/WASM layout. If the fallback remains shipped, force the primary engine failure and confirm the actual fallback identity, dimensions, transparency behavior and measured native result.
6. Run the final ordinary suite, TypeScript/build and staged-source privacy gate under root ownership. Re-review changed finding paths and record their final hashes.

## Snapshot hashes

SHA-256 receipts collected at the time above. These identify the reviewed working tree; later repairs require new receipts.

| Path | SHA-256 |
| --- | --- |
| `src/App.tsx` | `9269f734104b571510b2aeaf6b7e42c95f4ae46ed7e03009813bdb40322e981f` |
| `src/components/PngSvgWorkspace.tsx` | `cdd9d4497bb64951856cab0aac9c66917e91474a8c08de806e84b079b1f13a36` |
| `src/components/png-svg.css` | `a1c840bc3cf2595f3e1837bceb27ec9873d3bcf29ff23b4bccd12ca2987f12e6` |
| `src/components/ArchiveTree.tsx` | `aaa3433b19b6e70ef9f932cb08342478939278afe82505919ce466db39974180` |
| `src/useIconCollection.ts` | `f11ab48c41145f407b38b4b3d5e1464dc6d9b9e3e4c61569fbd60b11fb5fb335` |
| `src/icon-collection.ts` | `5b782490bb0aef889c8a4931b0986e3db703462ba23c1e32a9085d8ec39a231f` |
| `src/icon-drop.ts` | `da985e90a8ad502c512cf134ecdb88fc26a368fa97a72dcc24706210f7b039d6` |
| `src/icon-types.ts` | `6de29c09f454663cb8cb9f7783a985dd31b277ca8c27a98abf2205cbca2bc2a9` |
| `src/identity.ts` | `18e481ade950e87f04c0e98c49cbfdcc93f8f0f40f0d9bfae3f7af97e97c5dbd` |
| `src/png-svg.ts` | `da3fa7766285427bf73297fa8e56c667c81d8d4053ab0f0afb12139244f3034e` |
| `src/png-svg-browser.ts` | `ff0388768925fdfa8de0a076d6e8b76813677dc5dbdeb6809ec7461ed9a8f690` |
| `src/png-svg.worker.ts` | `dfcc0a77887594ed42894504720e0ba4cc4f5ad1f99eaf9fa0a1d50e5e2ebbfc` |
| `src/png-svg-trace.ts` | `c4047a21a56dacb251ccab327560b7b4fdcbcbd3f6581d80c407ac5055b74f63` |
| `src/png-svg-trace.worker.ts` | `2bc22af040f3b7cbb6fd887a386878caccc6d638fa940b0539f91ef2dc36fcc7` |
| `src/png-svg-download.ts` | `90e65a69e58bee08f2610882db7c6389d3faac7fbb4794fbca2f8721e89bed76` |
| `scripts/vtracer-assets.ts` | `bfcb7b1b2774685ff2debb4f3afbd011a58d852725cd9f63335466874d5749fc` |
| `scripts/build-worker.mjs` | `d0fbdce8f437736bd0c89c4959bdaee3799f6f2b04372d9ef7e7b7a82852c42c` |
| `scripts/check-repository-privacy.mjs` | `4eee011bc8278edfb0a2285991f849e001b584b2b6c0c7606fac34abd3fdbee6` |
| `vite.config.ts` | `a5810afb511734ea1ceb3e26884881372b9105e638b4fcc1a055bb414c3a307f` |
| `package.json` | `45f3d0f78fbeaae74ddcafe3d95f55ff2ca794f87a25c2abb30baaeae881955d` |
| `package-lock.json` | `a4cf2ce3225425412ad1a625ed2f20cbdffeac914cf1b199b80c792b15f91acc` |
| `fix-plan.md` | `6b9cacc1007c26d7315bc2e616f7e68efd026b07f6af29e0345df3d8cd0292e2` |
| `test-plan.md` | `bb721f23d9c4d02d218aab9f3a6d4af1c1e52d7501e10bfd12680b7e7c28f1b5` |

## Focused repair readback — 2026-10-29 15:05:41 UTC

The following are source-resolution conclusions only; no browser test was run by this reviewer.

| Finding | Readback evidence | Static outcome |
| --- | --- | --- |
| R4-C1 | `navigationRevision` and `currentTab` distinguish current user context. Library intake uses explicit `setLibraryExpanded`/`setLibrarySelectedId`; guarded completion updates `tab`, `kind` and hash together. Tab/hash changes invalidate older import navigation. | Resolved-static |
| R4-A1 | Batch Stop tracks focus/blur ownership. A `pending === 0` effect returns focus to Mode only when that disappearing control owned it; explicit Stop activation still moves focus immediately. | Resolved-static |
| R4-A2 | Both identified normal-text selectors now use `var(--muted)`. | Resolved-static |
| R4-A3 | Confirmation awaits removal before closing. Duplicate/cancel actions are disabled during the mutation. Modal only restores a connected enabled invoker and otherwise uses the active top tab. A guarded next-frame fallback catches a subsequently disabled/deleted target. | Resolved-static |
| R4-C2 | No upstream notice artifact/build change yet observed. | Open |
| R4-C3 | Preference success still passes through the generic error-clearing mutation wrapper. | Open |

| Updated path | SHA-256 |
| --- | --- |
| `src/App.tsx` | `9b847cb2b57439d63f3e943dd1b6fcd9996f26e356dfa21c3b9f88faf7a22a05` |
| `src/components/PngSvgWorkspace.tsx` | `cdd9d4497bb64951856cab0aac9c66917e91474a8c08de806e84b079b1f13a36` |
| `src/components/png-svg.css` | `ccd8b80847f801e8998ac6b1a0c01500cdcc86e5af20794f72b29a5937911bf6` |
| `src/useIconCollection.ts` | `f11ab48c41145f407b38b4b3d5e1464dc6d9b9e3e4c61569fbd60b11fb5fb335` |
| `scripts/vtracer-assets.ts` | `bfcb7b1b2774685ff2debb4f3afbd011a58d852725cd9f63335466874d5749fc` |

## Final focused source readback — 2026-10-29 15:15 UTC

### R4-C3 — operation error retention

`useIconCollection` now stores operation and preference errors separately. `setPreferences` no longer calls the generic error-clearing mutation wrapper. A successful preference write clears only `preferencesError`; a failure updates that channel without overwriting the operation error. The public banner gives operation errors priority. Successful explicit intake clears both because intake also commits its preference changes atomically. This satisfies the reported source defect. No runtime preference-error-retention result is inferred from the separate storage harness.

### R4-C2 — notice source and distribution wiring

The coordinator explicitly assigned the reviewer the notice document after the finding. `THIRD_PARTY_NOTICES.md` now contains the two exact npm runtime notices, the binding notice and a package-to-license-section map for all 49 registry packages in the pinned binding lockfile. Each official crates.io archive matched its Cargo.lock SHA-256; both npm archives matched their lockfile SHA-512 integrity and installed LICENSE bytes. The retained text preserves the upstream authors/years, selects offered MIT alternatives, and shares a complete Apache-2.0 section for the Apache-only curve library versions. BSD-2-Clause, Unlicense, supplementary COPYING and Unicode-3.0 terms are included. The two published archives without license files are explicitly documented using pinned upstream evidence; no missing copyright year is invented.

The document is 71,913 UTF-8 bytes with 28 distinct retained text sections. A focused integrity read verified every retained text hash and every section reference. The document contains no NUL and remains below the existing 1 MiB source-blob limit. This does not replace root's actual index privacy gate.

The executor-authored `vtracer-assets.ts` whitelist now maps `THIRD_PARTY_NOTICES.txt` to the repository document for both development serving and production asset emission, while retaining the original wrapper LICENSE. Its path is fixed, not supplied by user input. The coordinator remains responsible for checking the actual final distributed asset. Notice preparation and source wiring do not constitute a legal opinion, an exhaustive whole-app license audit or a reproducible-WASM-build attestation.

### Final smooth routing readback

The current `generateSmoothSvg` calls VTracer only for fully opaque inputs. Detected silhouettes go directly to the ImageTracer silhouette profile; general RGBA uses ImageTracer; failure of the opaque VTracer path still uses the explicit ImageTracer fallback. `TRACE_ENGINES.silhouette` identifies ImageTracer 1.2.6/profile 1. VTracer's binary/mask invocation is removed. Native verification and safe SVG normalization remain on the actual retained output for every route.

This bounded change responds to the actual quality result without relaxing the independent oracle or zero-difference check. It still needs the coordinator's final rerun and production-layout verification.

### Browser evidence received and inspected

The coordinator's `artifacts/revision-4-browser-verification.md` was read. It records the actual Chrome 155/Linux/DPR 1 collection run completed at **2026-10-29T15:04:53.800Z: 13 passed, 0 failed**, including native source/result transaction aborts, independent lease owners, stale mutation rejection, exact source/SVG persistence and historical provenance. The reviewer did not execute that browser run. The attempted raw JSON export was unavailable in the synced checkout; this review cites the coordinator's written observations rather than claiming an available raw JSON report.

The same report retains the initial engine quality failure: VTracer silhouette 4× alpha MAE `3.00750732421875` versus pixel baseline `2.7148980034722223`. The measured ImageTracer silhouette candidate achieved `1.7295464409722223` with the required two components, one hole and thin detail. Those are coordinator-observed experimental results on the procedural oracle, not a universal quality claim or proof of the final production build. The report explicitly leaves final engine, UI and production gates outstanding.

### Final focused hashes

| Path | SHA-256 |
| --- | --- |
| `src/App.tsx` | `9b847cb2b57439d63f3e943dd1b6fcd9996f26e356dfa21c3b9f88faf7a22a05` |
| `src/components/PngSvgWorkspace.tsx` | `cdd9d4497bb64951856cab0aac9c66917e91474a8c08de806e84b079b1f13a36` |
| `src/components/png-svg.css` | `ccd8b80847f801e8998ac6b1a0c01500cdcc86e5af20794f72b29a5937911bf6` |
| `src/useIconCollection.ts` | `ce494d6202ad461e95ecfd19dbcb6ec921777344d05c165f509e92b9e5ef4114` |
| `src/png-svg-browser.ts` | `d7b50c564f7b4184a189afe7f00da54f023d6ad880794ba7b36163553a5b9dd3` |
| `src/png-svg-trace.ts` | `70f0dea9985bb7426867cd625ceffe432127e66bbb1fdf109d82a19ff7cc7d00` |
| `scripts/vtracer-assets.ts` | `e1e0ba489d63767a42004edcfdf6e4a18d6e669ab0fa01778b16b3055eade1a8` |
| `THIRD_PARTY_NOTICES.md` | `19c5ddd94e75a5645f4689d19b39b561f2e3374fb07ea67f7e8dea4e12aef243` |
| `artifacts/revision-4-browser-verification.md` | `89bf933e81130347cc2b747dbfe9de90730af7f8eaafa4b5a2e028230b320f2f` |
