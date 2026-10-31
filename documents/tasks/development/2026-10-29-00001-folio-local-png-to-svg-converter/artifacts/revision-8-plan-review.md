# Independent GPR review — Folio revision 8

Reviewer: `/root/ai_package_audit`. Date: 2026-10-31 UTC. Record: `folio/documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter`.

**Verdict: blocked pending two bounded plan corrections (F9–F10).** This is a plan correction, not a request for more user permission. After the coordinator incorporates them and obtains focused readback, the authorized implementation can proceed. The unavailable real user-host/account test is a separate completion dependency; it must not prevent completing and testing the independent implementation work.

Read the GPR command, plan-reviewer profile, criticizer and relevant record contract; current request/record/fix-plan/test-plan/checklist/critique; revision-8 assessment/architecture/design/behavior evidence; supplied-package assessment; and all of `ai-auth-research.md`, including its final restricted-permission addendum. Inspected maintained `icon-collection.ts`, icon types and relevant callers, plus canonical Worker routing. No application, record, dependency, account, Git or deployment change was made. No runtime test is claimed.

## Findings

### F9 — high — make effective Codex isolation and operational readiness decisive

**Evidence:** `fix-plan.md` line 15 calls for feature/help probing, ignoring user configuration and restricted permissions. T20 only specifies injected fake-executable integration plus broadly described real-host testing. The research addendum explains that legacy sandbox settings can override the new profile, that `mcp_servers={}` is not a proven global removal mechanism, and that there is no established universal CLI no-tools flag. The supplied package uses broad `--sandbox read-only` and does not inspect effective integrations. Help/version support alone cannot establish the stated privacy boundary or a working supported adapter.

**Affected:** R8/R25/R28/R29; P9/P12; T20/T25.

**Minimal correction:** Explicitly adopt the addendum's fixed, documented restricted profile and pre-inference effective-configuration gate; never combine it with legacy `--sandbox`/`sandbox_mode`. Require disabled command/web/apps/MCP/plugins/hooks, restricted reads and no command networking before advertising SVG capability. If the pinned CLI cannot establish this through a supported checked interface, use the documented app-server stdio/config/per-turn restricted-read alternative or keep that installed version unavailable with an exact reason. The companion must fail closed without silently relaxing protection. Consume generation events and abort/reject unexpected tool activity or incomplete outcomes as an additional detection layer, not the filesystem boundary.

Add decisive T20 assertions for unsupported controls, inherited/legacy conflicts, unexpected tool events, incomplete-but-parseable JSON, and no inference spawn before capability validation. Separate fake protocol assertions from actual installed-version isolation evidence. A catalog or help pass must not satisfy R25/R29 as “working account-connected SVG AI.” Real-host verification, when available, must attach a harmless image whose content is not disclosed in the text prompt. No personal files or credential inspection are needed for these checks.

**Disposition suggestion:** unresolved → fixed_in_plan after these bounded acceptance obligations are recorded. This does not require implementing both transport designs; choose one that can prove the contract.

### F10 — high — define independent saved source and folder ownership

**Evidence:** `fix-plan.md` line 19 promises independent saved artwork across conversion deletion while reusing folder IDs and retaining only “source identity” explicitly. In maintained `src/icon-collection.ts`, `getSource` requires a live conversion record; `remove` deletes its original Blob, and `removeFolder` deletes those sources and the referenced folder hierarchy. Thus separate saved SVG rows alone can leave saved work orphaned from the shared tree and without the source needed for later comparison. T22 currently names conversion deletion and retained source identity but does not assert original-byte independence or recursive folder deletion.

**Affected:** R9/R19/R26/R31/R32; P10/P11; T21/T22/T23.

**Minimal correction:** Make each accepted saved record self-contained through an immutable source Blob snapshot or an explicit reference-counted source owner independent of the conversion row. Persist base SVG, derived SVG/color, source dimensions/provenance and source ownership atomically; only show “saved” after commit. Define shared-folder deletion: preserve/reparent surviving curated artwork to the permanent Uncategorized folder (or retain its referenced folder) and never silently orphan or delete it when deleting conversions. Explicit removal of a saved record remains available through the existing confirmation behavior.

Require T22 to save an AI or conversion result, remove its original conversion and then its containing folder, reload, and verify discoverable saved artwork, unchanged source/base bytes, reset/recolor, native comparison and exact preview/export bytes. Include one forced transaction failure proving the prior saved result and original collection survive with no false save-success message. T23 should assert late generation completion after selection change, retry, discard, cancel and deletion cannot attach/save to a new item. These are direct tests of promised ownership, not an added cloud-sync or history feature.

**Disposition suggestion:** unresolved → fixed_in_plan after ownership/deletion/atomicity semantics and decisive checks are stated.

### F11 — advisory — clarify embedded conversion saves and recolor fidelity labels

**Evidence:** R31 permits saving selected conversion results; retained conversion modes include embedded PNG/WebP. The same plan paragraph rejects every `<image>` in its safe vector subset while also saying embedded results cannot be recolored as vectors. Keep the stricter untrusted AI geometry validator, but state whether Save is restricted to vector results or whether trusted local embedded conversions have a separate narrow original-byte validation path and explicit bitmap label. Do not globally relax AI SVG validation to accommodate this case. Keep existing embedded conversion/download behavior regardless.

For recolor, “clear earlier match state” must mean visibly unverified/changed, never zero-difference or an old count on changed bytes. Whenever a comparison is shown, test the actual derived bytes against the retained original and record the new count/provenance. Reset restores the immutable base. These clarifications can be implementation-level if their accepted behavior is recorded before coding.

## Scope and feasibility reconciliation

- **Retain:** same-page icon AI, actual image attachment and optional instructions, candidate comparison/save/discard/cancel, shared settings, saved/recolorable artwork, compact existing menu/dialog/tree, and frequent milestone pushes. These directly fulfill S4 and retained UI constraints. Local conversion must continue without the companion.
- **Retain as necessary:** Node loopback companion, explicit pairing, exact Origin/Host/token checks, bounded fixed operations and process cleanup. Source proves subprocess execution cannot simply run in the current Worker/browser. Existing credentials remain owned by the CLI; pairing credentials stay out of server/Git and source media uploads occur only on explicit AI actions.
- **Provider scope:** OpenAI via locally signed-in Codex is supported in principle by the researched official interface. The supplied source has only Codex/Grok; DeepSeek must not appear usable. Grok discovery can be shown separately from disabled image execution. Shared asset/capability contracts plus an actual selected-Image-to-SVG action honor the current first SVG feature and “future features / keep that in mind” wording. Do not describe it as arbitrary raster image editing.
- **Account scope:** using documented Site sign-in/sign-out and identity headers fulfills account access without a second password system. Label local display-name preferences honestly. Provider-managed password/security links are appropriate; no invented Folio password facade. T24 must remain unverified for real signed-in identity until that session exists.
- **Persistence:** browser-local durable storage is consistent with the current application, but “always persist” cannot be reported literally. Save/reload/independent deletion semantics must work; clearing site data, eviction and quota remain accurately explained. No unsolicited account cloud migration is warranted.
- **License:** preserve the package's exact AGPL-3.0-only license, notices, provenance and modified corresponding source in the published repository/companion distribution. The source-only bundle must be built from reviewed files; no uploaded `dist`/`node_modules` execution. Do not silently relabel vendored files or claim a license-compatibility review that did not happen.
- **Completion:** R29 remains open/blocked until a paired companion on the user's computer, actual CLI ChatGPT sign-in, browser loopback permission and an attached-image inference succeed. Production sign-in verification is likewise separate. The existing plan correctly instructs completing all available code, tests, packaging, commits and release work first. Do not mark real account inference complete using mocks, a catalog, a cloud agent's credentials or a test button that only checks health.

## Review receipt

These are the reviewed pre-reconciliation hashes. Current metadata correctly remains `planned/not_ready`, revision 8, with no reviewed revision. Its prior plan/request hashes are stale placeholders; the coordinator should stamp the new S4/hash state through the normal finalizer only after material corrections/readback. This reviewer does not finalize the record.

| File | SHA-256 |
| --- | --- |
| request.md | `ba87f871978522343e6e293904ac80377e7ac82a6f517858f72ed6936bcd41b3` |
| record.json | `a74c00c73213a6a7440eba706057325912050ef77e156864ed60b9c876d1573e` |
| fix-plan.md | `7914ea32d6a5a450ffe3cb61a70b99c3c57474875415101dee975dc4af15a00a` |
| test-plan.md | `aeffc0d4d5f2a4c9a01fa64ddaff0c0606a70a26e79fde8fa89d4bc03ec0ed56` |
| checklist.md | `8fc393026184b2cea55e8b0ea87e0feaff96c7e4fdbeece5120a9f3e682e87da` |
| critique.md | `d15cd58f408489691f5f8ac5d8e6e2c64d32f339352a95fa7445626227fb7dee` |
| ai-auth-research.md | `2ae5404e57a10ad2287aa1f97b5488d721876b89be6d47835dba355cf3fea216` |
