# Browser verification — PNG to SVG

Executor: /root. Actual browser: Chrome 155.0.0.0, Linux, device pixel ratio 1. Development origin: http://terminal.local:4173/. Tests ran 2026-10-29, 13:24–13:29 UTC. This is runtime verification by the integration author; independent source and security review are recorded separately.

## Native renderer checks

Generated with `node --import tsx scripts/prepare-png-svg-check.mjs`, opened `/.qa/png-svg-check.html`, and activated **Run browser checks** through the browser UI. The actual converter, dedicated worker, PNG decoder and serialized SVG renderer ran. Report: **19 passed, 0 failed**, completed 13:24:16.602 UTC.

| Pixel-vector fixture | Native size | Merged shapes | SVG bytes | Differing pixels |
| --- | --- | ---: | ---: | ---: |
| Opaque | 16 × 12 | 6 | 486 | 0 / 192 |
| Fully transparent, with hidden source RGB | 7 × 5 | 0 | 148 | 0 / 35 |
| Partial alpha | 10 × 6 | 49 | 4,320 | 0 / 60 |
| Antialiased | 15 × 13 | 38 | 3,389 | 0 / 195 |
| Actual indexed palette with tRNS | 11 × 7 | 32 | 2,664 | 0 / 77 |
| Multicolor | 19 × 11 | 209 | 11,765 | 0 / 209 |
| All 256 alpha values across ten colors | 256 × 10 | 2,550 | 230,944 | 0 / 2,560 |

Additional checks passed:

- Embedded partial-alpha SVG: original 314 PNG bytes identical after extracting the data URI; SVG 633 bytes; 0 / 60 differing pixels.
- Deliberately altered opaque pixel: exactly **1 / 192** differing pixels, status `different`.
- Changed hidden RGB on 35 alpha-zero pixels: zero visible differences.
- Malformed SVG: `unavailable`, null difference count and a reason; no verified result.
- Invalid PNG, 4097 × 1 header, input above 20 MiB and APNG control chunk: rejected with the expected errors before inappropriate decode/allocation.
- Already-aborted conversion: AbortError with no progress events.
- Abort at a real worker-progress event: AbortError, with worker progress observed.
- 400 × 400 unique-color fixture: pixel mode rejected the 160,000-shape result; explicit embedded mode succeeded with 0 / 160,000 differing pixels.
- JSZip round-trip preserved three distinct collision-resolved names and every SVG byte.

The reference is browser-decoded 8-bit sRGB canvas RGBA. RGB is ignored only when both alpha values are zero. These results do not certify other browser engines, color profiles, 16-bit source precision or smooth enlargement.

## Actual application journeys

- A real file chooser imported all seven generated PNGs into the top-level app; all completed. A separate responsive harness dispatched file drag events into the actual app and all seven displayed **Pixel match verified**.
- Library → converter → Library preserved the Images view and `preserved-filter` search text. Returning to the converter preserved seven results, selection and an explicit embedded conversion. Library remained at zero image imports: converter inputs did not become collection items.
- Explicit embedded retry displayed “Bitmap inside SVG” and “not editable vector artwork,” with 0 / 60 differences. The default mode remained pixel vectors for new files.
- Native zoom measured both original and SVG DOM image boxes at exactly 16 × 12 CSS pixels. Other zoom choices and checker/light/dark backgrounds remain presentation-only.
- A 30-file alpha-sweep batch was stopped during processing: one file was ready and 29 were stopped. Retrying `cancel-02.png` produced the second ready file with 0 / 2,560 differences. Other stopped files did not resume or receive stale successes.
- Invalid PNG showed a useful error and no generated SVG. The 4097 × 1 input showed the allocation-limit error and **zero original-preview image elements**, confirming CR1's preview validation repair.
- Duplicate source names `icon.png`, `ICON.PNG`, `icon (2).png` produced `icon.svg`, `ICON (2).svg`, `icon (2) (2).svg` without overwriting.

## Download payload evidence and tool boundary

The real **Download SVG** and **Download ZIP** buttons were invoked. The cloud browser's download-event API did not return a saved artifact for these blob downloads. A request to inspect Chrome's internal downloads page was blocked by the browser URL policy; it was not bypassed.

The dev-only, one-shot observer in the responsive harness then observed the app's actual download anchor while invoking its original click. It read only same-origin local blob URLs and restored the anchor method immediately. Evidence:

- 13:28:08.675 UTC: `icon.svg`, 486 bytes, exact equality with its generated preview SVG, original anchor click invoked.
- 13:28:34.953 UTC: `folio-svg-icons.zip`, 1,012 bytes, exactly three unique entries above; each entry byte-for-byte equal to its own generated preview. Failed inputs were excluded and the UI reported the exclusion.

Filename allocation, serialized payloads, ZIP contents and the actual click path are verified. **Browser/OS file delivery was not observed by automation** and is not claimed as a downloaded-file readback.

## Responsive and keyboard checks

The actual app ran in a 390 × 844 CSS-pixel iframe (real responsive layout, not device emulation). Inspection at 13:25:12.536 UTC measured client and scroll width both 390, no horizontal overflow, and no visible action buttons outside the viewport. All seven file badges were verified. Visual inspection confirmed compact stacked controls and previews with vertical scrolling.

Keyboard actions in the actual app confirmed:

- Tab from an invalid file's selected row reached its Remove button.
- Enter on Remove moved focus to the neighboring persistent file-selection button.
- Enter on Retry moved focus to the same persistent row and retained it after success.
- Enter on Clear all moved focus to Add PNGs.

Static accessibility review additionally verified labels, focus outlines, hidden-workspace exclusion, contrast repairs and guarded asynchronous focus recovery. No screen-reader or second browser-engine certification is implied.

## Privacy and regression boundary

Converter modules have no network, cloud, Drive, database or persistence path; independent review confirmed local numeric geometry/base64 generation and local ZIP creation. The application still loads its normal app assets and may request existing Library metadata. The development origin cannot read the production private collection because its request reaches sign-in; production user data, authenticated cloud mutations and Google Drive journeys were not tested or modified. The existing application suite covers the unchanged storage/import/Worker logic.

Only source-generated fixtures and test code are tracked. Generated PNG/SVG/ZIP and screenshot payloads remain outside the repository.

## Published app smoke check

After native publication of version 9 succeeded, the connected browser loaded the published app and its existing Library, then opened the PNG to SVG view. Both navigation and new controls were visibly present. No catalogue contents or user-file names are copied into this repository. The optional automated file-chooser attempt timed out. A later read-only observation found completed live conversions: the selected 96 × 96 result displayed 310 merged shapes and **0 / 9,216 differing pixels**. The agent did not claim to have supplied those live inputs; no filename or image content is recorded here. This confirms the deployed conversion path in addition to runtime source equality and the development-browser suite.
