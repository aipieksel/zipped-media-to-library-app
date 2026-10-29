# Bounded independent security verification

Reviewer: `/root/fidelity_research` (GVS, read-only). Date: 2026-10-29. Scope: newly added local PNG converter and App integration under plan revision 2. This is targeted source review, not a full application penetration test or ASVS certification. No live services/accounts were exercised; no new server endpoint, role or authorization policy is introduced.

Initial verdict: **one medium resource-boundary defect (CR1) needs repair**, detailed in artifacts/code-review.md. No exfiltration, executable-markup injection, path traversal, secret exposure or new server authorization defect was found in the inspected change.

## Trust and action matrix

| Actor/input | Authorized action | Boundary inspected | Result |
| --- | --- | --- | --- |
| Local user-supplied PNG bytes | Decode, convert and compare on the device | FileReader; inspectPng; native canvas; dedicated Worker | Engine validates limits before decode; UI preview initially bypasses this ordering (CR1). |
| Local user-supplied filename | Display as text; choose safe download basename | React text rendering; allocateSvgFilename; ZIP revalidation | No filename interpolation into SVG/HTML; path/control/reserved names normalized and collisions reserved. |
| Generated SVG geometry | Image preview and user-triggered download | Numeric shape serialization, Blob image, exact same output string | No innerHTML, scripts, foreignObject, external href or original filename markup. |
| Original PNG in embedded mode | Preserve bytes inside SVG | Fixed data:image/png base64 image href | Original bytes embedded only; no source-controlled URL or executable attribute. |
| Converter file/result state | Remain local to current tab | Converter module imports and source searches | No fetch/XHR/beacon/WebSocket, DB/IndexedDB, localStorage, cloud or Drive dependency. |
| Existing library/backend | Existing behavior and access only | App diff; unchanged cloud/database/Worker sources | Converter does not invoke saveImport or add new backend route; unrelated preexisting collection reads remain possible. |
| Downloaded ZIP entries | Flat safe SVG file names and exact output | buildSvgZip name validation and JSZip API | Traversal separators, controls, duplicate normalized names and reserved device names rejected. |

## Checks performed and limitations

Read converter implementation, UI, App diff and synthetic tests. Searched the changed dependency graph for network/storage sinks and markup injection primitives; only SVG namespace URLs appeared, not file-upload URLs. Checked source ownership, original-byte handling, bounded geometry generation, per-file/session limits, job cancellation guards and URL cleanup. No credentials or user media were introduced by inspected files. Existing dependency versions were reused; no new package supply-chain change exists to assess.

CR1 reproduction is established by the source control flow: addFiles installs sourceUrl before convertPng validation and selected preview renders that URL immediately. Root must repair and perform the targeted invalid/oversized-input UI verification. Static dependency review is evidence that converter code contains no upload path; actual browser/network observation remains necessary for the full privacy acceptance claim. Browser decoder security, all existing app endpoints, dependency CVE audit, other engines/color profiles and total device memory exhaustion were not comprehensively tested.

Source hashes and exact reviewed revision are recorded in artifacts/code-review.md. No implementation fixes, test changes, installations, commits, builds or browser actions were performed by this reviewer.

## CR1 repair verification

Focused readback confirms the source preview is now created only in a guarded `converting` progress callback after PNG structure, allocation bounds and native decoded dimensions have passed. The `addFiles` path no longer exposes unvalidated bytes as an image source. Active-job/abort/item-status guards prevent a cancelled or removed item from acquiring a new preview URL. Previously validated immutable files may safely reuse their source URL on retry.

**CR1 is resolved in source; no open material findings remain in this bounded static security review.** The repaired component hash is `d29511e97c57a314734a6ab254bbd0b379df462cdd6f8ededbf7b7fe1d4b196b`; the engine hashes are unchanged. The trust-matrix PNG decode row now passes the inspected ordering boundary for engine and UI paths. Root's actual oversized/invalid UI and converter network observations remain separate runtime evidence; no runtime claims are inferred from this approval.
