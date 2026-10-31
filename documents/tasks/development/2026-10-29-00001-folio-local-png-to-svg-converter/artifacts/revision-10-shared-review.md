# Revision 10 — independent shared-persistence review

Reviewer: `/root/r10_ui_audit`. Date: 2026-10-31. Workflow: GVR code reviewer, with the selected media-library and database specialist profiles. Scope: implementation authored by `/root/r10_design_research`, reviewed without editing its application sources. The coordinator owns Git, deployment, native browser operation and the consolidated verification record.

## Disposition

**Code review closed for the source hashes below. No unresolved material finding remains in this bounded review.** All five finding groups have corrections and passing focused evidence. The final authored suite independently reran with **10 passed, 0 failed**, including real 20,001-file cumulative publication/readback and collision-safe conversion/Saved ZIP recovery. The coordinator's separate native IndexedDB/renderer receipt now records **8 passed, 0 failed**. The reviewer read that receipt and confirmed all 17 recorded source/test hashes remain unchanged; the reviewer did not operate the browser. Broader account/UI QA and deployment remain separate gates.

## Scope and evidence method

Read the complete shared client, codec, metadata schema, document-manifest adapter, runtime, migration, migration equality and SVG trust modules. Traced their consumers through `db.ts`, `icon-collection.ts`, `useIconCollection.ts`, the shared Settings actions and existing ZIP exporter. Checked staged writes and acknowledgement ordering, lazy source/output records, per-record CAS recovery, local queue leases, logout fencing, explicit legacy migration and remote SVG/fidelity handling.

The Node checks execute actual production imports, codecs, HTTP client, manifest adapter, migration comparison, SVG validation and ZIP filename validation against a synthetic in-memory transport. They do not use production accounts or files. Node in this environment has no IndexedDB or native canvas. Transactional IDB and rendered-pixel evidence comes from the separate coordinator-executed native harness described below; this reviewer inspected its source and read the stored result.

The reviewer previously implemented the dropdown and account form/client work. Those files are excluded from this independent review; their separate reviewer is recorded in `revision-10-client-security-review.md`.

## Findings and corrections

### GVR-SH-01 — valid imports exceeded the whole-document metadata bound

**Priority: P2 / medium. Original boundary:** `shared/client.ts`, `shared/codec.ts`, runtime document publication.

The original adapter serialized the whole collection into a 1 MiB document. A real 2,000-file PNG import with only 140,000 original bytes produced about 1.25 MiB of metadata and was rejected. The baseline importer accepts 20,000 files per import. Since this was a whole-collection limit, splitting an import did not resolve cumulative growth.

The corrected adapter uses immutable, verified metadata-manifest chunks and packs small source files into bounded chunks. One CAS still publishes the complete dataset. Legacy direct document data and whole-file references remain readable. The low-level HTTP request limit is unchanged.

Independent actual-import results after correction:

| Input | Original bytes | Metadata bytes | Root PUT bytes | Published chunks | Result |
|---|---:|---:|---:|---:|---|
| 2,000 tiny PNGs | 140,000 | 1,316,809 | 382 | 2 | Published and read by a second client; first/last originals byte-exact |
| 20,000 tiny PNGs | 1,400,000 | 13,204,527 | 541 | 3 | Published and read by a second client; first/last originals byte-exact |

An additional repro found that the first correction retained a new **global** 20,000-record store bound. A 20,000-file import plus one existing file was rejected. The author raised the explicitly bounded collection store limit to 100,000 while preserving the existing per-import 20,000 limit and 64 MiB metadata bound. The same 20,001-record encoder repro now accepts the combined dataset. This is a bounded collection, not a claim of unlimited storage.

Evidence: `/tmp/folio-r10-shared-review/capacity.mts` captured the original rejection; `capacity-current.mts` exercises the corrected actual import/encode/write/read paths. The final ten-test suite independently also builds and parses a real 20,000-entry HTML ZIP, shares it through two clients, verifies selected original content, and publishes/reads a further import to prove 20,001-file cumulative storage.

### GVR-SH-02 — shared SVG bytes and remote verified labels were trusted too early

**Priority: P2 / medium. Original boundary:** shared `IconCollectionStore` getters/snapshot and metadata validation. The finding establishes untrusted content acceptance and misleading fidelity; it does not claim that a script was executed by an image preview.

Shared source/output descriptors initially hydrated bytes without applying the existing SVG allowlist to a remote result, and remotely supplied `verified` fidelity could suppress a receiving browser's check. Minimal saved metadata also passed the original loose validator despite missing fields consumed by the UI.

The correction validates UI-required metadata, rejects active or unsupported SVG content, and only accepts embedded output if it exactly equals a wrapper rebuilt from the fetched source bytes. Shared snapshots override remote verification labels with a device-local map. The map's identity includes source/output chunk descriptors, native dimensions, item identity/revision and conversion mode or saved provenance. A conversion getter runs a local native check; Saved only accepts a result stamped for the currently served byte identity. The canonical remote provenance remains separate, so a check does not start a polling write loop.

Independent executable byte-level checks: safe vector accepted; script, event-handler and external-image SVGs rejected; exact embedded wrapper accepted and modified wrapper rejected; incomplete Saved metadata rejected; changing source or output chunk identities changes the verification key. These checks establish validation and identity binding, not native rendering by Node.

### GVR-SH-03 — validating a normalized SVG did not validate the bytes returned

**Priority: P2 / medium. Boundary:** `shared/icon-trust.ts` calling `sanitizeSvg`.

The first trust correction discarded the sanitizer's normalized return so it could preserve original safe bytes. The sanitizer may supply missing width, height and viewBox, so a vector with no native declarations passed validation and was returned unchanged. A downloaded standalone SVG could therefore have different intrinsic dimensions from its metadata.

The helper now additionally requires all three native declarations in the original bytes. Existing sanitizer validation checks their actual values. The independent missing-dimensions repro now rejects with the expected native-declarations error; the authored suite contains a regression as well. No normalized output is incorrectly stamped with a check for an earlier byte string.

### GVR-SH-04 — packing made unchanged legacy records appear conflicting

**Priority: P2 / medium. Boundary:** `shared/migration.ts` equality during repeated explicit migration.

Adding a new legacy file changes the packed-chunk hash and slice descriptor of an unchanged old file. Comparing whole encoded records with `stableJson` therefore produced a migration conflict even when the original bytes and metadata were identical. The repro used actual imported raster records and encoder output; the unchanged record's descriptor changed from a 70-byte whole-file reference to a slice of a larger verified pack.

The new `sameMigrationRecord` compares changed descriptor fields against the real preserved original Blob and the integrity-verified existing shared bytes. It retains strict equality for ordinary metadata and requires matching MIME and size. Managed icon names are allowed to differ so an earlier safe collision suffix preserves the currently published name on retry. It does not trust an unverified per-file digest or overwrite a genuinely changed shared record.

Independent focused verification: unchanged bytes across a new pack compare equal; changed metadata and changed original bytes both compare unequal. Full IndexedDB migration retry is a separate native-harness claim.

### GVR-SH-05 — independent same-name additions can publish duplicate ZIP filenames

**Priority: P2 / medium. Boundary:** `shared/codec.ts` explicit three-way recovery and the migration merge's collection invariants. **Status: corrected and independently reverified.**

Two clients can each allocate `mark.svg` while adding different new icon IDs against the same base. A CAS conflict is correctly retained, but `reconcileDatasets` then merges the distinct records without reapplying filename or sibling-name uniqueness. The resulting dataset passes validation. The actual `buildSvgZip` rejects both ready icons with “SVG download names must be unique, safe filenames. Re-import the affected icons.” Saved additions have the same invariant.

The independent `/tmp/folio-r10-shared-review/collision.mts` calls the actual encoder, reconciliation function and ZIP builder and originally reproduced two accepted `mark.svg` filenames followed by a rejected export. No bytes were overwritten because the ZIP builder is defensive; the shared collection nevertheless became impossible to export as requested.

The correction extracts the existing sibling allocator into `shared/icon-names.ts`, preserves currently published names, and safely allocates candidate filenames and sibling names during explicit recovery and migration. Validation now rejects duplicate or unsafe incoming SVG download names. It leaves the ZIP safety guard intact. A lost acknowledgement is recognized without changing already allocated suffixes or duplicating records.

Independent `collision-current.mts` executes both Conversion and Saved paths: `mark.svg` stays with the latest published item; the incoming item becomes `mark (2).svg`; both real ZIP builders succeed; sibling folders become `Folder` and `Folder (2)`; a repeated recovery produces the same dataset; direct duplicate filenames are rejected. A migration-style merge uses the same safe allocation. The final authored suite also contains and passes this regression.

## Positive source findings

- Ordinary shared writes clone to a recovery stage. The live cache is installed only after a server acknowledgement and validation. Failed publication retains attempted input instead of falsely exposing it as saved. No-op writes explicitly clear the retention flag and clean their stage.
- Explicit recovery uses a three-way comparison against the retained base and the latest server document. Independent record edits merge; divergent same-record edits remain conflicts. A lost response after server success can reconcile to the already published candidate without another mutation.
- Source and output bytes are immutable, chunk hashes and lengths are checked before use, slice offsets/lengths are bounded, and the manifest's referenced hashes must exactly match its publication. Decoded cache records keep lazy descriptors rather than pretending zero-length placeholders are the original file.
- Worker claims and heartbeats remain local. A shared pending row preserves a matching local claim only for the same revision and mode. Completed results remove shared-pending markers; user cancellation explicitly removes them. The conversion hook pauses a shared publication failure and preserves its recovery path instead of immediately overwriting a retained result with another failure or rerunning it indefinitely.
- The request controller remains active through response-body consumption, `close()` aborts outstanding work, requests reject redirects, and a total 25-second deadline bounds interrupted connections. Shared reads/writes capture and test the originating session epoch. The Icons database opener now fences its resolution like the Library opener.
- Explicit migration captures its original session before reading/hashing and checks it before staging and between datasets. Inventory is read-only. Neither workspace startup nor inventory uploads historical browser files. Original legacy databases are retained; the durable migration ledger is committed with the acknowledged dataset.
- Curated cloud records and device-only preferences are excluded from the shared overlay. Existing curated source bytes are not uploaded by these adapters. Shared favorites/hidden roots and saved SVG/color/source identities are represented separately from disposable thumbnails and local UI preferences.

The separate App asynchronous-job lifecycle issue is owned by the backend/client reviewer as **F-CLI-01**; request timeout/redirect handling is cross-referenced there as **F-CLI-02**. These are not duplicated as independently owned findings here.

## Executed checks and limits

- `node --import tsx tests/shared-client.test.ts`: **10 passed, 0 failed** on the final hashes below. Covers exact multi-chunk bytes, stale CAS, packed slices and corrupt-chunk rejection, real 20,000-entry ZIP plus a cumulative 20,001st file, changed-pack migration comparison, SHA-256 fallback without SubtleCrypto, required metadata/lease filtering, independent/same-record recovery, conversion/Saved filename recovery, shared SVG trust, response-body cancellation and signed-out placeholder denial.
- Independent corrected-capacity, SVG-trust, migration-equality and collision scripts described above executed directly against production functions. The original collision repro now produces unique names and an accepted ZIP; the expanded correction regression passes all assertions.
- Read `tests/shared-client-browser-check.ts` and its credentialless runner. They target actual IndexedDB, real converter/native SVG rendering, migration/idempotency, retained failed writes, explicit recovery, local claims, source preservation and logout. The conversion-specific failure case verifies that a completed SVG is retained, its local job is paused, no automatic retry is claimable, and explicit recovery publishes the original result. The child refuses existing Folio databases, and the parent records whether its original database-name inventory changed. The coordinator executed this harness and supplied the passing receipt below; this reviewer did not execute it.
- No broad build, Git mutation, browser operation, account creation, real media migration, provider request or deployment was performed by this reviewer. Backend authorization/SQL, visual/accessibility completeness and hosted cookie/session behavior are outside this receipt.

## Coordinator-owned native persistence receipt

Read `artifacts/revision-10-native-persistence.json`, written by `/root` after reading the completed visible DOM report through the supported cloud browser. Receipt SHA-256: `820c0c92472a153bb4a6f4a7bda30aedcd4cbf3249c8eaaf3ca8512b7b07dd90`.

| Receipt field | Recorded result |
|---|---|
| Executor | `/root` |
| URL | `http://terminal.local:4173/tests/shared-client-runner.html` |
| Browser | Chrome 155.0.0.0 on Linux |
| Completed | `2026-10-31T19:00:47.869Z` |
| Focused native checks | 8 passed; failed array empty |
| Isolated credentialless partition | `true` |
| Parent database-name inventory unchanged | `true` |
| Transport/account scope | Synthetic in-memory server; no production account or provider calls |

The eight reported groups cover read-only inventory; identity/source/Saved-color migration and idempotency; no-op cleanup and retained failed writes; independent CAS recovery; importer-only conversion claims and native SVG checking; hidden curated roots without reupload; logout fencing and retained input; and preserved original browser-database inventory. Source inspection of the harness confirms that the conversion group includes a deliberately failed completed-output publication followed by an explicit successful retry.

This is actual native IndexedDB and SVG-rendering evidence for that isolated Chrome fixture. It does not establish production cookie behavior, a teammate's real login, cross-browser/color-profile fidelity, or a real historical-file transfer. The original-preservation assertion compares inventory counts/byte totals, with exact migrated source/output comparisons elsewhere in the harness; it is not an exhaustive hash comparison of every legacy database byte.

## Final source identity and closure

The author explicitly announced the final shared-source freeze. The reviewer reran the ten-test suite and recorded the following SHA-256 values. Closure applies to these bytes. Subsequent persistence, naming, trust or lifecycle changes require an affected delta review.

| Reviewed source | SHA-256 |
|---|---|
| `src/shared/client.ts` | `ebbeb13ecd28661fbde8ef09d25dc49097dc095dd2c8d32d13a1b2c4086a131d` |
| `src/shared/codec.ts` | `e46edda6acc50466c33a5241f3122def5fe18b4eb51c41bfd56e00215a87396c` |
| `src/shared/documents.ts` | `84d7c8b7cb4ec0775e4a2852514b866d315574be218dbc5bd093d99b706976c9` |
| `src/shared/icon-names.ts` | `56265ee5dd47bd75c0afa101b1d43855251184bc835b63b2d3c8d8104e01cfa7` |
| `src/shared/icon-trust.ts` | `d79fbee87ff9149b89b50e2a4caae256f5a21b7fd601a77934e6f5bed64f8ea7` |
| `src/shared/metadata.ts` | `4a51a8d672ca7f736402f95933a634a033bd3eef462900c87107be517b289b92` |
| `src/shared/migration-equality.ts` | `850bca8e874219e814abce193177fc50e418b9217276d756f1e34ed96fff073b` |
| `src/shared/migration.ts` | `4c460ff2ba2f9bd1e3c09970f919f7e6dffa9208d0437257db1664d887172884` |
| `src/shared/runtime.ts` | `2a9b0ea161d2c633d0bbddae5c7b040c96dd8bf3cf37b78a4532a9364567af31` |
| `src/shared/workspace.ts` | `98743ed2506955f3fd70c20cfed4e9054cfa397c2e500c84cd6d4f5858010585` |
| `src/db.ts` | `171a5a5824370e413091fe8d35acbaa59c8dc0bd2853e733ab493cb433d3ff7c` |
| `src/icon-collection.ts` | `61334e19c239c5d0f11064b7036ec6dedb62239cfea0fbd1bbd0df167fa4d101` |
| `src/useIconCollection.ts` | `39356b0dac4f8e99d123d450a0e47cbdf0712b2c25b004af88ffb7058f76d285` |

| Verification source | SHA-256 |
|---|---|
| `tests/shared-client.test.ts` | `23aea759c1ff7c0a28d08fbf7c7591e4d0f153fdebec2b842cd9f50156fe4af2` |
| `tests/shared-client-fixture.ts` | `ab21a920725a990406961b30eb783eeb821787a4649202f6d8353980ff74147d` |
| `tests/shared-client-browser-check.ts` | `337127f3550001ee2396fd665fb2759c7127a6820c91cfa395d02d093b7d9cc3` |
| `tests/shared-client-runner.ts` | `57f7356516578f4ff3173dc7dfb0952547f0ac8e18063f83c7b0ee1c3d5b740d` |

All five finding groups are closed at the code-review level. The matching coordinator-owned native IndexedDB/renderer receipt is now attached as separate passing evidence. Real hosted account/session verification, broader visual/accessibility coverage and deployment completion must not be inferred from this source review or the isolated synthetic fixture.
