# Independent security verification — repair review

**Decision: PASS for the bounded source/handler checks; browser enforcement remains parent-owned.** Prior availability defect C2 is repaired. No high-impact confidentiality defect or parent-origin escape was found in this review. This is not a security certification.

Review actor: `/root/review`. Re-review time: 2026-10-26T17:56:56.406806+00:00. Same task record, reviewed plan revision **2**, fix-plan SHA-256 `5a4606f4cc2912ef725c9015390d26a6806b8ba9af9768becdae96eedb1aa797`. Ordinary-agent adapter; no native queue receipt is claimed. Reviewer wrote only review reports; all application fixes belong to root or separate implementation agents.

Repository baseline: new files with no local Git HEAD at initial review. Exact source hashes below identify the repair baseline. Managed-browser and deploy results remain parent-owned and are not inferred here.

## Trust boundaries examined

| Actor/input | Permitted operation | Evidence |
|---|---|---|
| Imported HTML and script | Render and run within its archive | Live and capture iframe sandbox is exactly `allow-scripts`, without same-origin, top-navigation, forms or popups. |
| Child resource request | Read selected archive members | Exact iframe `event.source` plus per-generation channel, path shape check, Map scoped to one archive, concurrent request cap. No generic network proxy/workspace mutation message exists. |
| Parent command | Return resources or request capture in exact child | Child verifies source `parent`, parent origin and channel. Resource requests have timeouts. |
| ZIP bytes and names | Become validated Blob records | Raw headers checked before JSZip sanitization; traversal, collisions, malformed/unsupported/encrypted/symlink/overlapping input rejected; stream checks declared/actual size and CRC. Worker limits and timeout bound import. |
| Capture message | Save image for current page | Blob type/size and dimensions validated; PNG signature checked; IDB verifies page still exists; abort and finished flags prevent stale writes. |
| Imported metadata | Display as application text | React text rendering and JSON `<`/separator escaping; uploaded HTML never inserted into parent DOM. |
| Root removal | Delete that root's descendants and captures | IndexedDB transaction indexes byRoot/byArchive; no unrelated root deletion path. |

## Closed S1 / C2 — cyclic CSS availability defect

The prior sibling-import cycle reproduced as permanently pending compilation. Current source serializes import traversal, checks ancestry before pending cache reuse and warns at a cycle. Actual helper harness now settles successfully; capture preparation is separately timed and abortable. Byte/resource limits still do not constitute protection against every expensive user-authored script; imported scripts are untrusted rendering content and may use CPU within their own frame.

## Safe handler harness evidence

Using actual `src/frame.ts` transpiled in memory with a minimal fake event target (no browser automation), assertions passed for: unrelated window ignored, previous channel ignored, current channel accepted, invalid step direction ignored, unrelated/stale resource requests not executed, valid request executed once, invalid capture payload rejected, and detached handler not acting on stale messages. Exit 0. This validates application decision code; it does not replace browser same-origin/sandbox enforcement checks.

## Additional evidence

Archive tests: `node --import tsx tests/archive.test.ts` exit 0, all **11 passed**. Shared tree tests: `node --import tsx tests/tree.test.ts` exit 0, all **4 passed**. The current wrapper and import-map repair harness passed; no boundary broadening was found (all paths remain scoped to the selected archive Map). No application code or dependencies edited by reviewer. No secrets were found in reviewed application files. No new server endpoints, roles, accounts, auth policy or external service were introduced, so no fabricated server-authz test is claimed.

External scripts/assets preserve network behavior; help explains this. Opaque frames prevent workspace DOM/storage access but do not promise to block all external requests. The channel is not secret from the imported page: that page is authorized to request its own resources. Browser enforcement of parent access denial, unrelated child-window forgery and live teardown is assigned to parent T4. Dependency advisories and full hostile CPU/memory testing were not performed.

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
