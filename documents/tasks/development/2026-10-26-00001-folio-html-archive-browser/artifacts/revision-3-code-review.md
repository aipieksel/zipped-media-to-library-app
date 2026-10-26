# Revision 3 — independent code review

**Source decision: APPROVED.** No high or medium source/data-integrity defect was demonstrated after the reviewed repairs. ZIP/SVG runtime delivery remains an open deployment verification item (R3-D1 below); this approval does not complete R15.

Reviewer `/root/review`; author(s) `/root`, `/root/tree_fixes`, and image component implementation agent. Time: 2026-10-26T18:19:54.440346+00:00. Approved plan revision **3**, fix-plan SHA-256 `22c89e34ea7e5249b8b38a2cabbea7ff9aa579f5c3110eb5860d9392a509c784`. Ordinary-agent adapter; no native receipt, implementation edits, browser operation or dependency installation is claimed. This reviewer wrote only these three revision-3 review reports. Git is initialized with no HEAD at this review; exact source hashes below identify the baseline.

## Closed finding R3-C1 — medium — overflow at 100% zoom

The compact stylesheet initially changed `.preview-canvas` to `justify-content:center`, which places the start of a wider, nonshrinking iframe on the negative scroll side when Fit is disabled. Root repaired this to `justify-content:safe center`; source recheck confirms overflow can align at its start. Root should verify actual horizontal scrolling at 100% in T6.

## Data and state review

- **Additive upgrade:** `db.ts` upgrades to version 2, adds `folders` and `organization`, and backfills image metadata from retained file records using existing IDs and Blob sizes. Every awaited operation inside migration is an IDB request on the versionchange transaction. Errors capture a migration reason and abort; no database delete/reset exists. Existing HTML, original file Blobs, screenshots and prefs are not replaced. Fresh version 0 creation and existing version 1 upgrade are distinct branches.
- **Image/HTML identity:** optional missing kind is interpreted as HTML. New images use their file record's original `${archiveId}/${path}` ID. Image counts are accumulated through ancestor archives without altering HTML page counts. SVG is classified for image-element rendering, not parent HTML insertion.
- **Organization transactions:** favorite updates preserve folder assignment; moves validate item and folder and preserve favorite. Folder creation validates/trims/NFC-normalizes names and checks case-insensitive duplicates inside one transaction. Removing an import deletes only its roots' items/files/captures/organization, and preserves user folders and unrelated roots.
- **Projection:** `buildOrganizedTree` returns custom folders plus unassigned archive items, separated by kind/favorite. Search, tree, previous/next, keyboard, galleries and capture targets use the same projection. Items appear once and retain IDs; empty archive groups are pruned, empty user folders retained. Manage imports keeps removal reachable after every item was moved.
- **Selection effects:** selection is repaired only when it is no longer in the current kind/filter set. The guarded effects converge; the tree memo does not depend on expanded state. Wrap navigation uses modulo over filtered items, independent of collapsed branches. Moves keep the selected ID and linked resource owner.
- **HTML-only capture:** both `runCaptures` and `putSnapshot` exclude image items. Settings conditionally exposes HTML controls. Image mode uses image viewer/gallery and exact original-byte download.
- **Resource lifetime:** image file reads are selection-scoped; disposed promises do not create URLs. Each created URL is revoked on cleanup. Gallery observes cards lazily and disconnects observer/registrations; canonical IDs are React keys. Current download URL lifetime is owned by App: one-click delivery after preparation, then revocation after 30 seconds. The temporary dialog experiment is documented below and removed.

## Independent checks actually run

| Check | Exit / result |
|---|---|
| `node --import tsx tests/archive.test.ts` | 0; **14 passed**, 0 failed/skipped/cancelled |
| `node --import tsx tests/tree.test.ts` | 0; **8 passed**, 0 failed/skipped/cancelled |
| Initial in-memory `download.ts` delivery harness (historical implementation) | 0; packaging bytes/paths and then-current URL-cleanup assertions passed; did not prove browser delivery |
| Adapted current prepared-download helper harness | 0; ZIP path/byte identity, original Blob identity and invalid/missing guards passed |

Archive tests include original nested real wrapper reconciliation, malicious/malformed size/path/CRC cases, nested image classification, direct image byte identity and invalid direct-image batches. Tree tests include old archive search semantics plus kind separation, empty folders, moves, favorites/search and move-back identity.

The download harness transpiled actual `download.ts`, supplied only DB/DOM/URL mocks and a Node FileReader shim for JSZip Blob reading. It rebuilt a three-member resource ZIP, reopened it with JSZip, compared each HTML/CSS/image path and byte, checked original image/source-only Blob identity, and invoked all three 30-second URL cleanup callbacks. It validates packaging logic; root still must inspect actual browser downloads.

## Boundaries

This reviewer did not independently run real IndexedDB, browser decoding, focus interaction, screenshot rendering, production build or deployment. Root reports the old browser workspace retained 19 HTML items, seven screenshot badges, 103 indexed images (102 original +one compatibility image), and the original selected HTML ID; those observations belong to root's T7 evidence, not this source review. Corrupt but extension-supported image bytes may be retained and report decode failure in ImageViewer; no conversion capability is claimed. No universal HTML-export, browser-compatibility or pixel-fidelity guarantee is made.

## Historical experiment — prepared download and explicit Save file (superseded) (2026-10-26T18:26:47.130525+00:00)

**Source decision: APPROVED.** Root reported that the earlier asynchronous scripted-anchor path did not emit real browser downloads, despite the packaging harness passing; synchronous screenshot downloads did. That browser observation supersedes any inference that a successful packaging harness proves file delivery. The earlier harness is preserved as historical byte/path evidence only.

`src/download.ts` now returns `PreparedDownload { blob, filename }` without creating links, URLs or clicking the DOM. App awaits preparation, creates one owned object URL and opens a native **Download ready** dialog with an actual `<a href=... download=...>Save file</a>`. The dialog holds the URL while it remains open; effect cleanup on replacement, close or App unmount schedules revocation after 30 seconds. The ready record contains a fixed filename and size for the prepared file, independent of subsequent item selection. The dialog participates in `anyModal`, so global file-navigation shortcuts are suppressed while saving. No imported bytes are uploaded or modified by this change.

An adapted in-memory harness against the actual current helper passed (Node stdin ESM, exit 0): all resource ZIP member paths/bytes match; image and source-only HTML return their exact original Blobs; image-as-HTML and missing-file guards reject; no DOM dependency is needed during preparation. Source checks confirmed the visible download anchor, ready-dialog keyboard gating and URL-cleanup wiring. This harness did not click the browser Save file link or emulate a browser download; root must provide that final runtime evidence.

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
