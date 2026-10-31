# Revision 10 — documentation consistency review

Date: 2026-10-31. Reviewer: `/root/r10_design_research`. Initial scope: read-only comparison of README, PRIVACY, linked companion guidance and current revision-10 implementation/review/contract/native-receipt artifacts against final application/server source. Applied the workflow documentation-updater contract as a review only. A small read-only delegate checked provider claims; the findings below were rechecked against the source. That initial review wrote only this artifact. The coordinator subsequently authorized the documentation corrections recorded in the closure section. No application, task-governance, Git, build, browser or deployment action was performed by this documentation update.

**Current disposition: D10-01 through D10-07 closed.** The authorized documentation update corrects the specific wording below and retains the original findings and document identities as historical review evidence. The account/shared-storage distinction is accurately documented; source, synthetic tests, native runtime and deployed activation remain distinct. This review did not discover a new implementation defect or rerun the coordinator's tests.

## Original findings — corrected by the authorized documentation update

| ID | Location | Source evidence and requested wording |
|---|---|---|
| D10-01 | README, Icons removal paragraph and Published Site section | “Removes its saved local copies” and “persistent local Icons collection” are stale. `icon-collection.ts` delegates material operations to acknowledged shared writes. Describe removal of conversion entries/original references from the shared workspace, affecting all members, while preserving independently saved artwork and original files on disk. Describe shared Icons with local conversion. Keep publication status tied to the actual release receipt. |
| D10-02 | README, Development / VTracer paragraph | “Conversion requires … no … image upload” is too broad for the authenticated app: imported sources are uploaded before automatic conversion begins. Say the tracing engines require no remote tracing/model service; authenticated source/result persistence uses the private shared workspace. PRIVACY's distinction between local computation and shared storage is already correct. |
| D10-03 | PRIVACY, saved-artwork deletion paragraph | “Deleting a saved icon removes its own snapshots” can imply physical erasure. `worker/workspace.mjs` explicitly states immutable blobs are never deleted by this service; removal changes active metadata/references. Disclose that this release retains immutable server chunks and does not guarantee erasure of uploaded bytes. Previously downloaded copies also remain outside app control. |
| D10-04 | README, AI payload description; PRIVACY, Explicit AI actions | The “only image/SVG/instructions” disclosure omits the sanitized source filename. `src/ai/client.ts` includes the original basename in `image.name`; `src/ai/prompts.ts` sends it as `sourceName`. Include “source filename” in the transmitted payload. The full filesystem path is not sent by this preparation code. |
| D10-05 | README, AI limits | Both the original and the normalized native-size PNG attachment must fit 8 MiB. `src/ai/client.ts` rejects an oversized normalized PNG even when a compressed JPEG/WebP original fits. Document both checks. Also include the shared codec's 100,000-record-per-store bound alongside the existing 64 MiB manifest and chunk limits. |
| D10-06 | Linked `companion/README.md`, Privacy/persistence paragraph | “The app's identity is managed … by its hosting platform” conflates the new Folio account with hosting access. State the three distinct identities: Folio email/password account, private Site hosting access, and optional Codex provider sign-in. Main README and PRIVACY already describe this correctly. |
| D10-07 | `revision-10-server-implementation.md`, development-QA fixture paragraph | “Production HTTPS/Secure-cookie proof remains the separate workerd test above” overstates the isolated test. It proves HTTPS cookie semantics in a synthetic native Worker journey; production hosted cookies, migration application and owner setup require the separate deployment/runtime receipt. The surrounding artifact correctly keeps deployment pending; align this sentence with that limitation. |

Small precision improvements: qualify automatic queue resumption as belonging to the importing browser; say legacy databases remain untouched **through** migration; describe Original colors as restoring base bytes followed by the shared browser's fresh check. Add the new shared harness preparation command to the development handoff if README is intended to enumerate current browser gates. Its generated HTML lives under ignored `tests/shared-client-*.html`, so “all generated HTML stays in .qa” should be generalized without loosening privacy exclusions.

## Evidence and remaining gates

The saved `revision-10-native-persistence.json` actually records eight passing groups, no failures, Chrome 155, completion at `2026-10-31T19:00:47.869Z`, `isolatedPartition:true` and unchanged parent database names. Its explicit scope is native IndexedDB/rendering with an **in-memory synthetic transport**, not production account/storage/provider verification.

One receipt-label precision: “byte-for-byte inventoried” is stronger than the legacy-preservation assertion in `tests/shared-client-browser-check.ts`, which compares inventory counts and total Blob sizes. Preserve the raw observed receipt; describe this particular assertion as unchanged legacy inventory/byte totals. Exact payload round trips, hash integrity, read-only migration source and the browser's isolated partition are separate supporting evidence, not a claim that every original legacy Blob was independently rehashed in that assertion.

The coordinator reports the full Node suite at **328 passed, one existing optional skip**, the separate privacy checks at **4 passed**, and successful TypeScript/Vite/Worker builds. The coordinator also reports actual shared import/retry/automatic conversion/Save/recolor/Appearance use, mobile two-Escape/focus behavior, and 320/768/1440px no-overflow/nonwrapping observations. Those reports must remain distinct from this read-only review and from the saved native persistence receipt.

Do not claim completed OS download delivery, the interrupted later whole-app reload/migration journey, real OpenAI inference with the owner's account, a teammate's hosted sign-in, production owner-password activation, or deployment from the available evidence. The shared preview was replaced by another project during later checks; OS download observation timed out. Deployment was pending at review time.

Dated assessment, delegated-implementation and source-review artifacts legitimately retain their original “coordinator evidence pending” scope. A final aggregate verification/release receipt should state which later gates were actually satisfied rather than rewriting old observations as if their authors executed them.

## Verified positive statements

- All Folio members share one dataset; account identity is separate from hosting and AI identity. Invitations do not widen the private Site audience or send email.
- Registration is invitation-bound; owner bootstrap/recovery use the configured trusted Site-owner boundary. Password changes revoke prior sessions and pending recovery capabilities, then issue a replacement current session.
- No sign-in-only migration of original browser files occurs. Curated cloud originals are reused. Display preferences, worker claims and companion pairing remain local.
- Shared writes await acknowledgement; root index, expanded metadata, chunk and file bounds match the documented implementation, subject to the additional record-count note above.
- OpenAI/Codex is the enabled adapter; Grok execution remains unavailable and DeepSeek is not implemented. CLI compatibility probes and synthetic inference tests are not represented as a successful owner-account request.
- Native pixel checks remain browser/color-space scoped. The docs do not promise universal browser/profile fidelity or exact smooth reconstruction.
- Checked all 16 relative README links; none were missing. PRIVACY and the companion README contain no additional relative Markdown links requiring resolution.

## Reviewed document identities

These identify the wording reviewed before any coordinator correction:

| Document | SHA-256 |
|---|---|
| `README.md` | `aefd00b9db049d5bc808c02e68067e5d27d30b171ebd1976ffa76040ea5baad8` |
| `PRIVACY.md` | `c7051ca7e8cc9c3e30df292c962285e4f30ea6902c8760e069e7b24052d9a165` |
| `companion/README.md` | `44dd5dee86e4c4b690b910b7f636193c5d6b51629965b15400f8c431538adb59` |
| `revision-10-http-contract.md` | `13831c43bee8a31ec30256378ba1ebcc66ecf06ff78939fddf1caa5956016dfd` |
| `revision-10-native-persistence.json` | `820c0c92472a153bb4a6f4a7bda30aedcd4cbf3249c8eaaf3ca8512b7b07dd90` |
| `revision-10-server-implementation.md` | `fd4aed54d902f9aa19f6dd1dfce4f3e329e8dd10d09017f13868e2067a7fa6a0` |

The provider/limit conclusions above are grounded in `src/ai/client.ts`, `src/ai/prompts.ts`, `src/ai/useAi.ts`, companion implementation and the source-backed delegate check. Storage/account conclusions use `src/shared/**`, `src/icon-collection.ts`, `src/FolioRoot.tsx`, `worker/workspace.mjs`, `worker/auth.mjs` and the corresponding independent review artifacts. No web lookup was needed for this source-to-document comparison.

## Authorized documentation closure — 2026-10-31

The coordinator subsequently authorized implementation of the seven corrections, limited to project documentation and these evidence artifacts. All seven are closed by the following changes:

| Finding | Applied correction and verification |
|---|---|
| D10-01 | README now states that authenticated removal changes shared conversion entries and original-image references for every member; independently saved artwork and original/local copies remain. Published Site describes shared Icons with local conversion and still requires the actual release receipt to identify the live revision. Both stale local-only phrases are absent. |
| D10-02 | README's tracing paragraph now distinguishes local tracing assets from authenticated source/result uploads to private shared storage. The broad no-image-upload claim is absent. |
| D10-03 | PRIVACY describes removal of active artwork/snapshot references and explicitly states that this version retains immutable server chunks. It makes no erasure promise for previously uploaded or downloaded bytes, matching `worker/workspace.mjs`. |
| D10-04 | README and PRIVACY both disclose the sanitized source filename alongside the selected image, current SVG and instructions. They identify the basename rather than a full filesystem path, matching the actual image preparation and prompt fields. |
| D10-05 | README includes the separate 8 MiB normalized-PNG check and the 100,000-record-per-store cumulative bound. The HTTP contract's client-metadata extension includes the same record bound and keeps the 20,000-entry limit scoped to each Library import. |
| D10-06 | The companion README now distinguishes Folio email/password identity, private hosting access and local Codex sign-in. Profile/password controls are described as Folio account actions, with hosting permissions and provider sign-in separate. |
| D10-07 | The server implementation receipt now calls its workerd cookie evidence an isolated synthetic native-runtime check. Hosted cookie behavior, migration application and owner activation remain dependent on the coordinator's separate deployment/runtime receipt. No historical test was promoted to deployed proof. |

Related precision improvements were also applied: importing-browser queue ownership; originals preserved through migration; fresh checking after restoring shared base SVG bytes; the reproducible shared-harness command and ignored generated-HTML locations; and exact password-change session replacement semantics in the HTTP contract. The shared implementation receipt now explains the inventory-count/Blob-size preservation assertion without rewriting the raw native receipt or implying every original legacy Blob was independently hashed.

### Closure checks

- Re-read the changed passages against their existing source evidence. No application source or runtime behavior changed.
- All 16 relative README links resolve; no additional relative Markdown links in the other changed documents were missing.
- Verified the obsolete local-only, no-image-upload, hosting-only identity and production-proof phrases are absent from their current operational documentation.
- Verified the existing shared-harness generator path exists. It was not executed during this documentation-only update.
- The raw `revision-10-native-persistence.json` SHA-256 remains exactly `820c0c92472a153bb4a6f4a7bda30aedcd4cbf3249c8eaaf3ca8512b7b07dd90`.
- No app code, task-governance record, Git, build, browser or deployment operation was performed. Prior test results and publication limits retain their original scope.

### Corrected document identities

| Document | SHA-256 after correction |
|---|---|
| `README.md` | `64bc3aca3536f8627b85be4b2c5f2d4448ecd36fc77a5a99c102a6caf5c004b8` |
| `PRIVACY.md` | `969a93fb7058fae6dfd891f148e266500554975fa356de99ac5d576826dd55e6` |
| `companion/README.md` | `b852f8d091e308e1256b1f2fa223b0c8ed840ff2373ccbe0f8cf677b23e9c582` |
| `revision-10-server-implementation.md` | `5f49f3562b52ecbd3472ee63d39528baade8dff72c8402089dcaaf30c587510c` |
| `revision-10-shared-client-implementation.md` | `a304dd0f5a4572f5e2e84ee0bb2c97bcfe3ea931493ccd6c61158b2fa031eae2` |
| `revision-10-http-contract.md` | `2ef68e30f15e403c48af7a8bc2dc84d7c98dd15d883d57c55cef38ad60be9c2f` |

These corrected identities supersede only the operational wording reviewed above. Original assessment/review observations and the raw execution receipt remain preserved. The documentation review has no unresolved correction within this assigned scope.
