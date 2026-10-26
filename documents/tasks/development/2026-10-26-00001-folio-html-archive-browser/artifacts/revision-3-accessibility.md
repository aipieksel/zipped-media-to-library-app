# Revision 3 — independent accessibility review

**Decision: PASS for the scoped source checks after repairs.** No full conformance or assistive-technology certification is claimed. Root owns actual keyboard/mobile browser observations.

Reviewer `/root/review`; author(s) `/root`, `/root/tree_fixes`, and image component implementation agent. Time: 2026-10-26T18:19:54.440346+00:00. Approved plan revision **3**, fix-plan SHA-256 `22c89e34ea7e5249b8b38a2cabbea7ff9aa579f5c3110eb5860d9392a509c784`. Ordinary-agent adapter; no native receipt, implementation edits, browser operation or dependency installation is claimed. This reviewer wrote only these three revision-3 review reports. Git is initialized with no HEAD at this review; exact source hashes below identify the baseline.

## Repairs verified in current source

**R3-A1 — medium — mobile drawer focus.** Initially the open sidebar left the obscured main content keyboard-focusable and lacked Escape/focus return. Current App tracks the narrow media state, sets main inert only while the narrow drawer is open, focuses search after opening, loops Tab among visible controls, closes on Escape and restores focus to the mobile menu. Closed drawer visibility remains hidden. The trap yields to native open dialogs.

**R3-A2 — medium — popover keyboard/focus.** Settings and Move popovers now focus their content, loop Tab through enabled visible controls, close on Escape and restore prior trigger. Action dismissal cleanup returns focus to a connected trigger unless pointer focus intentionally moved outside or a native dialog is open. Modal cleanup has a durable Settings fallback if its original element was removed. Native dialogs retain native modal focus containment; form dialogs focus an input/select after opening. Actual sequence verification is still required in root T6/T9.

**R3-C1 — medium interaction — 100% overflow.** `.preview-canvas` now uses safe center to avoid clipping the unscrollable negative start of a wide HTML/screenshot preview. This preserves compact gutters while allowing actual-size viewing; source repair verified, root browser scroll proof pending.

## Labels, semantics and contrast

The compact single toolbar retains accessible names for previous/next, favorite, move, download, Settings and mobile drawer. Type tabs expose selected state; Favorites and Gallery expose pressed state. Native inputs/selects retain their arrows; Up/Down cycle files globally while Left/Right operate tree branches. New images and gallery controls carry file-specific names/alt text. Status notices and errors are announced. Focus outlines and reduced-motion rules remain present.

Current sampled sRGB contrast calculations:

| Text / background | Ratio |
|---|---:|
| Accent `#b94c2d` / white | 5.08:1 |
| Secondary `#626c69` / white | 5.43:1 |
| Image metadata `#626b5b` / white | 5.57:1 |
| Form note `#66765b` / white | 4.88:1 |

The file-count total was also changed from `#738073` (4.15:1) to the darker shared text treatment after review.

## Scope and remaining browser checks

This is source plus color-math review. Root must verify the actual native-dialog return path, popover Tab/Escape action completion, drawer keyboard interaction and 390px rendering. No screen reader, browser zoom/reflow or exhaustive contrast/touch-target audit was performed here. Uploaded HTML accessibility cannot be certified by the viewer. The user explicitly requested high density; this review preserved compact layout and fixed interaction/access issues without restoring space-consuming UI.

## Historical experiment — prepared download and explicit Save file (superseded) (2026-10-26T18:26:47.130525+00:00)

**Source decision: APPROVED.** Root reported that the earlier asynchronous scripted-anchor path did not emit real browser downloads, despite the packaging harness passing; synchronous screenshot downloads did. That browser observation supersedes any inference that a successful packaging harness proves file delivery. The earlier harness is preserved as historical byte/path evidence only.

`src/download.ts` now returns `PreparedDownload { blob, filename }` without creating links, URLs or clicking the DOM. App awaits preparation, creates one owned object URL and opens a native **Download ready** dialog with an actual `<a href=... download=...>Save file</a>`. The dialog holds the URL while it remains open; effect cleanup on replacement, close or App unmount schedules revocation after 30 seconds. The ready record contains a fixed filename and size for the prepared file, independent of subsequent item selection. The dialog participates in `anyModal`, so global file-navigation shortcuts are suppressed while saving. No imported bytes are uploaded or modified by this change.

An adapted in-memory harness against the actual current helper passed (Node stdin ESM, exit 0): all resource ZIP member paths/bytes match; image and source-only HTML return their exact original Blobs; image-as-HTML and missing-file guards reject; no DOM dependency is needed during preparation. Source checks confirmed the visible download anchor, ready-dialog keyboard gating and URL-cleanup wiring. This harness did not click the browser Save file link or emulate a browser download; root must provide that final runtime evidence.

Accessibility delta: native dialog retains its Escape/Tab/focus behavior; Save file is a keyboard-operable native link with an explicit accessible label. Close remains available without saving. This is source review only; root must confirm real keyboard activation and focus restoration in the managed browser.

## Final bounded source review — one-click prepared downloads (2026-10-26T18:31:53.480455+00:00)

**Current source decision: APPROVED. Runtime download outcome remains partial until HTTPS verification.** The current implementation retains `PreparedDownload {blob, filename}` but removes the temporary Download ready modal. `downloadSelected` awaits preparation, creates a local object URL, assigns the sanitized filename to an anchor, invokes the download once, and schedules URL revocation after 30 seconds. Errors still produce a visible notice and release the busy state. The selected file is captured by the async call, so later selection changes do not replace its prepared bytes. No modal, extra confirmation, or user activation diagnosis is part of the final flow.

### Investigation provenance and limits

1. The initial source harness established resource ZIP byte/path preservation and cleanup; it did **not** establish browser delivery.
2. Root reported SVG and ZIP download waits timing out in the HTTP development preview. A temporary visible anchor and then a synchronous Save button also timed out for those formats, while the same synchronous button downloaded an original PNG and existing screenshot PNG successfully. Therefore those failures do **not** demonstrate that loss of user activation was the cause. The intermediate modal experiment is preserved above as history and has been removed.
3. Root reports the final one-click path downloaded original `storage-bg.png`, **1,393,391 bytes**, matching original SHA-256 `60cd557199e85fe896b368439d5ddc12b807edbb1c90982c05f29ab5da5d407a`.
4. **R3-D1 — runtime follow-up:** SVG and HTML resource ZIP delivery remain unverified in deployed HTTPS. An HTTP-preview/file-type restriction is only a hypothesis. Source review cannot close this observation, and R15 must not be marked fully verified until real deployed downloads succeed or a working scoped repair is verified.

`src/download.ts` is byte-for-byte unchanged from the already-passing prepared-download harness. The only reviewed source delta is App delivery/modal removal plus removal of the temporary modal styles. No additional archive/tree test run was necessary: those reviewed source files are unchanged. The current app does not append imported bytes to the parent DOM; it only gives the browser a download URL. No source/resource mutation, network upload or new privileged message operation was introduced.

### Parent-reported browser evidence, not reviewer-run tests

Root reports 107 images and 19 HTML items after nested/direct image imports, explicit invalid-image decode feedback, HTML/image favorites and moves surviving refresh, retention of original Minimal ID `a707e106-b3f5-4185-9c59-89e1743255e1/Minimal/index.html`, wrap navigation in both kinds, a successful current-page capture, and 390px layout/drawer/popover checks. These are appropriate T6–T9 observations but require the root's own evidence artifact; this reviewer performed no browser actions. The final source approval remains bounded to code, data integrity and UI control wiring.

## Exact reviewed source

- `src/types.ts`: `7f9871b3df78fca9deef869b1ee4340ce9850cf3319c3da5bbf142a25b791ea4`
- `src/archive.ts`: `85912fca35e8b843e5c3ba727e15532c3e98fb1c4db7c6878e91191941bb9b84`
- `src/archive.worker.ts`: `5929ff587470638d6b50b0c091f7a5078585b0f7c89435c0d194a3473d8e6d74`
- `src/db.ts`: `e6deb00461b2f2116504ef6b0cd1db42ec7a216ab561754e44586a4db3d951f9`
- `src/tree.ts`: `d2390a788f169ffd4553ba27c5f85872e667ebd3c125ee4770766f43c3f18a53`
- `src/App.tsx`: `8d171b00ce091c10742e73b88d29192a8e5f52568b6528995f79e73a86798071`
- `src/download.ts`: `29973c988ba76624922a289414d0b349a806fcd78d9cb7c2cb471e965d475514`
- `src/preview.ts`: `dbe04c9975a4866a19c5503f84d649909e8b3feb91f79b3ad5cbed36574e6e89`
- `src/frame.ts`: `7e7b899fb7602c56c752c64f6d134c35f79ea01e7ebe8497098c9f431a459728`
- `src/capture.ts`: `fe16686b333f0b1dcad71feb0aba841863ba05923ec25873ae33bc3a66d9c490`
- `src/components/ArchiveTree.tsx`: `c502d21442a21b020a0733bc4ebd0413219746eb84217889030604ece401c569`
- `src/components/Gallery.tsx`: `3ef3659e35ae06287df5321a68834f3a7329f7375495a188d762a773cb3e2698`
- `src/components/PreviewPane.tsx`: `80feb79282cfe21c464968e3c1824e86a6d58a12582f8bc6d1a704115150bdaa`
- `src/components/ImageViewer.tsx`: `48f41a0c4daa474cf1f7da73e4d69d0db4415b7881b95b3478f001ecaaeaac6c`
- `src/components/ImageGallery.tsx`: `49086cbbca27107a7b2d7f30fb98c2a04bbdf9d0990648a91bad104e404f167d`
- `src/components/images.css`: `3974d67031537b1d6eafdaa38ea95c931da948a7a18a98b2effe8f01c51f11a0`
- `src/styles.css`: `21efb15b02e0ac23854f9da19876301fad332e81af264f9f0289f0de248eaa85`
- `tests/archive.test.ts`: `5314d3739f8163208249e0c7d04fb31a07e578258430103208c06387bdcc02a7`
- `tests/tree.test.ts`: `d031f84e52b21a7d0e5ac69d951e2f8f2182fe74e72ead24abf43140931e5846`
