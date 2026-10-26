# Independent code review — repaired implementation

**Decision: APPROVED for this bounded source review. C1–C5 are closed against current source.** No remaining high or medium correctness defect was demonstrated in the reviewed scope. Required managed-browser evidence and build/publication gates remain separately owned by root.

Review actor: `/root/review`. Re-review time: 2026-10-26T17:56:56.406806+00:00. Same task record, reviewed plan revision **2**, fix-plan SHA-256 `5a4606f4cc2912ef725c9015390d26a6806b8ba9af9768becdae96eedb1aa797`. Ordinary-agent adapter; no native queue receipt is claimed. Reviewer wrote only review reports; all application fixes belong to root or separate implementation agents.

Repository baseline: new files with no local Git HEAD at initial review. Exact source hashes below identify the repair baseline. Managed-browser and deploy results remain parent-owned and are not inferred here.

## Findings and repair proof

| ID | Original severity | Repair and independent evidence | Status |
|---|---|---|---|
| C1 | Medium | Inline and linked styles now share `compileCss`. Actual helper harness expands inline `@import "theme.css"` and embeds the imported stylesheet's relative SVG background as a data URL. | Closed |
| C2 | High correctness / medium availability | CSS imports now traverse serially with ancestry checked before cached promises. Actual prior root→b/c, b→c, c→b cycle settles within 500 ms, preserves applicable rules and warns. Capture preparation is covered by its own 20-second timeout/abort before the iframe's separate 35-second timeout. | Closed |
| C3 | Medium | Bridge receives inferred wrapper; runtime resolver and static lookup both use it. Actual current helper parity assertions passed for root-relative assets, absolute synthetic URLs, relative paths, JSON path and external-origin exclusion. `/assets/a.svg` and `/data.json` correctly resolve to `export/assets/a.svg` / `export/data.json`. | Closed |
| C4 | Medium | Shared `filterTree` produces App's filteredPages, ArchiveTree projection, Gallery input and batch capture targets. Gallery no longer applies a conflicting second filter. Four regression tests passed for outer ZIP, folder, path, empty query and original-tree preservation. | Closed |
| C5 | Medium | Import-map values are canonicalized relative to HTML document base on ingestion; prefix mappings choose longest key. The actual prior nested module reproducer now resolves `lib` to `export/vendor/lib.js`; nested longest-prefix fixture resolves correctly. Scoped maps display an explicit limitation notice. | Closed |

Cryptographic IDs preserve `crypto.randomUUID` with `getRandomValues` fallback for managed HTTP preview. No weak randomness was introduced. Snapshot and tree/gallery identity remains the canonical HTML page ID.

## Independent checks actually run

- `node --import tsx tests/archive.test.ts`: exit 0, **11 passed**, 0 failed/skipped/cancelled. Includes real nested wrapper reconciliation (12 pages), index ordering, same-name IDs, Unicode, empty archives, traversal/collisions, size budgets, malformed nested input, CRC and header checks.
- `node --import tsx tests/tree.test.ts`: exit 0, **4 passed**, 0 failed/skipped/cancelled.
- Read-only current CSS helper harness: exit 0, inline imported CSS/asset and sibling cycle assertions passed.
- Read-only current module/runtime resolver harness: exit 0, C3/C5 assertions passed. Two harness-edit attempts failed due extraction-string/selector assumptions before corrected final harness passed; they were not app failures.
- Actual `frame.ts` in-memory handler harness: exit 0, wrong source/stale generation ignored, valid source accepted, invalid direction/capture rejected and detached listener inactive.
- Source inspection of transaction scoping, snapshot linkage, asynchronous teardown, import/queue locks, resource-map isolation and React text rendering.

## Scope and limits

The reviewer did not operate the browser, mutate application source, install dependencies, build/deploy, run a dependency-advisory audit, or verify all possible HTML exports. Root owns T2/T3/T4 managed-browser proof for visible assets, JS interaction, module execution, actual PNG images, keyboard behavior, isolated parent access, gallery identity and persistence. Browser-rendered captures are explicitly not guaranteed pixel-identical remote Playwright captures. Computed/scoped module behavior, embedded frames, server endpoints, external CORS and specialized media retain documented compatibility limits.

## Exact source snapshot

- `src/preview.ts`: `dbe04c9975a4866a19c5503f84d649909e8b3feb91f79b3ad5cbed36574e6e89`
- `src/capture-entry.ts`: `c709713c6835980f766a624f2accda6f48af154862340b84aec45b2cee0e3aeb`
- `src/capture.ts`: `fe16686b333f0b1dcad71feb0aba841863ba05923ec25873ae33bc3a66d9c490`
- `src/frame.ts`: `7e7b899fb7602c56c752c64f6d134c35f79ea01e7ebe8497098c9f431a459728`
- `src/App.tsx`: `e4e735348d441cdcd22b2bd4306ed9c7862f4f26c2fe76b7c752d2991bb088ab`
- `src/components/PreviewPane.tsx`: `36c5dbcdecee3a1eb5b1a0af86d089bfccc54458dabbfcfd9ec247fb2245ae28`
- `src/components/ArchiveTree.tsx`: `3d6cf18539302a3e5e0e6587f8e4350192312d2a106a716b6683b8722cbaf947`
- `src/components/Gallery.tsx`: `3ef3659e35ae06287df5321a68834f3a7329f7375495a188d762a773cb3e2698`
- `src/archive.ts`: `ad5c0abe9e079b593aac0e2e4b1570a4f973704f2623e5e58327da47302b1f36`
- `src/tree.ts`: `9921dd3d32623590e14b1c59aaab479968b821028e08b984dfacdad03b2db343`
- `src/db.ts`: `3aea7ed48005372254a7cd8d295578f4c64db55b48f4a2921968534ee3c354b6`
- `src/identity.ts`: `18e481ade950e87f04c0e98c49cbfdcc93f8f0f40f0d9bfae3f7af97e97c5dbd`
- `src/styles.css`: `6390a3d48cfb560817c214ed0872476fed489a64a7203426c2b7bd90ac622615`
- `src/components/collection.css`: `3fe01223436b8d211f0f63bf971a29f19d511c89955988f084cdfacb3dbe5841`
- `tests/tree.test.ts`: `8d2ef732dc37085cc9c0c4179b58278ae2aeedd1cb0cea8c1bd7a21c9282ab4a`
