# Independent plan critique — revision 1

Reviewer: /root/architecture. Verdict: **blocked pending two narrow plan corrections**. This is a real independent review of the six record files, preserved conversation source, package/bootstrap/hosting manifest, architecture consultation, fixture manifest and actual nested wrapper. No application code was edited and no execution gate was run.

Reviewed fix-plan.md SHA-256: `5a4606f4cc2912ef725c9015390d26a6806b8ba9af9768becdae96eedb1aa797`
Reviewed test-plan.md SHA-256: `cdee36639ac053bcfc735a5e51c89d9859cd10e20d97f8224b7fb4e00d7578b9`

## F1 — Medium — module resolution algorithm is ambiguous

Evidence: fix-plan Architecture says “Use es-module-lexer or browser import maps”. The package includes both es-module-lexer and html-to-image, but the preview does not yet exist. A data URL module cannot resolve relative imports; a bare import map does not repair a relative specifier inside a nonhierarchical data module, and does not map an entry script's src.

Minimal correction: specify a parser-based rewrite to stable absolute synthetic module identifiers, then a complete import map mapping those IDs to final data URLs before evaluation; rewrite entry script src directly. Cover static imports, literal dynamic imports, cycles if supported, and explicit diagnostics for unsupported computed/worker module cases. This clarifies R5/P2 without adding scope. Verify at least a two-module chain and literal dynamic import with visible DOM assertions.

Disposition: amend plan before execution.

## F2 — Medium — acceptance procedures need decisive assertions at claimed resource/bridge boundaries

Evidence: T2 generically checks “real pages and linked assets”; the real fixtures exercise classic JS and CSS but do not prove the module/fetch bridge claimed in P2. T4 says bridge is source/channel scoped without stating an unrelated-source or stale-channel attempt.

Minimal correction: add one synthetic fixture asserting local CSS @import and relative image/font URLs, actual classic/module JS execution and local JSON fetch. Extend T4 with unrelated source + stale channel rejection and proof that a harmless hostile frame cannot read parent DOM/storage or navigate top. Include reload with stable IDs and snapshot→same HTML selection under T3. These are targeted acceptance checks, not a new test platform.

Disposition: amend verification procedure and matching metadata before execution.

## F3 — Low — source evidence path is imprecise

fix-plan says `../fixtures/fixture-manifest.json outside checkout`, which does not resolve to the source from the task-record directory. Use `/workspace/scratch/d3a22467843d/fixtures/fixture-manifest.json` or a clearly documented checkout-relative `../fixtures/fixture-manifest.json` to avoid fixture-reconciliation confusion. The actual wrapper contains root index.html plus unchanged storage-banner ZIP (6 pages) and pattern ZIP (5 pages), so T1's expected 12 pages is grounded.

Disposition: correct while amending the plan; non-blocking by itself.

## F4 — Low — browser-local and capture limits must stay user-visible

The plan correctly excludes cloud upload and unsupported server/browser APIs. Real editor HTML may depend on localStorage, which opaque sandbox documents deny. Test the real editor page or report this specific compatibility limit; do not loosen sandbox isolation to make it render. A bounded in-frame memory adapter may be an implementation option if needed. State saved in this browser, keep tab open for captures, and call output browser snapshots rather than claiming a Playwright backend.

Disposition: preserve during implementation; runtime evidence required before the matching R outcomes are complete.

## Scope and feasibility assessment

S1 requested multi-ZIP imports, nested archive/folder hierarchy, every HTML page including root files, named index pages, hidden resources, keyboard navigation, screenshot batch/gallery indicators and source reveal, Library fixture verification and a published ChatGPT Site. R1–R8 cover these. R9 browser-local retention/removal is proportionate support for the selected local-workspace design; no cloud upload/sync is introduced. R10 is justified by executing uploaded scripts and inflating arbitrary ZIPs. No unrelated content edits, new paid provider or public publication is planned.

The implementation order and single-owner policy are sound. The largest feasibility risk is opaque-frame capture; the plan explicitly requires an early real browser proof. Service-worker inheritance and same-origin escape have been excluded appropriately. Existing UI audit is legitimately empty because this is a new project. Root must incorporate F1/F2 and obtain confirmation of that exact updated plan before claiming ready.


---

## Revision 2 re-review — APPROVED / ready

Reviewed by `/root/architecture` at 2026-10-26T17:10:31.318246+00:00. The parent supplied revision 2; I independently re-read fix-plan.md, test-plan.md and record.json, and read the Agents Pro v2 plan-reviewer profile. This is the ordinary-agent adapter; no native queue event or receipt is claimed.

Exact current inputs:

- Plan revision: **2**
- fix-plan.md SHA-256: `5a4606f4cc2912ef725c9015390d26a6806b8ba9af9768becdae96eedb1aa797`
- test-plan.md SHA-256: `cdee36639ac053bcfc735a5e51c89d9859cd10e20d97f8224b7fb4e00d7578b9`
- checklist.md SHA-256: `ab763ec2e644cc10260dc798bf5efddff043976e28ff4e7be32155c4ebed5b09`
- Source baseline: new static React/Vite project containing only package bootstrap, placeholder dist/index.html, hosting manifest and task record; no existing application UI or user code is being replaced. Package dependencies and exact Site manifest were inspected in the first review. No application implementation was present at that baseline.

**F1 resolved:** the Architecture paragraph now explicitly combines es-module-lexer rewriting, stable absolute synthetic specifiers, a complete import map to data URLs and direct entry-script URLs. The plan requires static and literal-dynamic import tests. This removes the faulty either/or interpretation.

**F2 resolved:** T2 now names concrete CSS @import/url computed-style and image assertions, a JS-driven button, local JSON fetch, a static module chain and literal dynamic import. T4 explicitly exercises forged messages from an unrelated source. T3 reload and T2 same-Page-ID gallery reveal cover persistence/link identity; source/channel scope remains required by T4. The executor should include stale-generation rejection in the same existing bridge check rather than adding a separate test platform.

**F3 remains a non-blocking documentation precision note:** the fixtures path is clearly described as outside the checkout and the actual absolute fixture manifest has been inspected. Use the verified `/workspace/scratch/d3a22467843d/fixtures/fixture-manifest.json` during tests.

**F4 is an execution verification constraint:** preserve opaque isolation, prove snapshots in the browser early, and report browser-local/capture limitations honestly. It does not prevent implementation.

All requested outcomes retain their R/P/T mappings. No new storage boundary, provider dependency or feature scope was introduced. Atomic workflow expansion preserves the same architecture/plan/build intent and single record. **There are no unresolved material plan blockers. Revision 2 is ready for the parent's finalization and execution admission.** Approval establishes plan readiness only, not passing runtime tests or completed deployment.


---

## Revision 3 independent plan review — APPROVED / ready

Reviewed by `/root/review` at 2026-10-26T18:07:11.428629+00:00. Plan author is `/root`; this reviewer did not author or edit the reviewed plan. This is the ordinary-agent adapter, not a native queue execution or host-authenticated receipt.

**Verdict: APPROVED. No material plan blocker was found.** The revised S2 behaviors are within the user's explicit request and preserve S1's HTML/assets/capture outcome. Approval applies to these exact bytes and establishes plan readiness only; it is not completion, migration success or browser/deployment evidence.

### Exact reviewed inputs

- Plan revision: **3**
- fix-plan.md SHA-256: `22c89e34ea7e5249b8b38a2cabbea7ff9aa579f5c3110eb5860d9392a509c784`
- test-plan.md SHA-256: `e8bd80542af64c1b69e55d1c456166bf0148fc6a71231cf62d07857f7d927b4e`
- checklist.md SHA-256: `43aed345eb78e47121b7076cae2ba2a4fa0b10c0820a81113899c9e82ae5c7a3`
- conversation.json SHA-256: `96615a785bdbb3b72afa62553fc53143bd1d2816669b693336639abc483199cb`
- record.json input SHA-256: `28cd66f25392a18db429df92d1bba929b00059f312bc85c513b6db24b9622302`

I re-read the preserved S1/S2 request, requirements, implementation steps, verification checks, source-baseline description and the exact plan/checklist files. The existing source interfaces were inspected in the preceding source review: `HtmlPage`, retained `ArchiveFile` Blob records, file/page IDs, v1 IndexedDB transactions, tree projection and App/gallery/capture owners. `git status --short` confirms the new application remains untracked; `git rev-parse --verify HEAD` reports no commit. The parent reports browser baseline of 19 HTML items, four roots and seven screenshots; this reviewer did not independently operate that browser.

### Coverage and feasibility

| Requested behavior / effect | Planned owner and mechanism | Decisive verification |
|---|---|---|
| Compact full-height sidebar, no logo/big drop/header/reload, settings before gallery | P6 root App/global styles; ~245 px full-height sidebar, one-line hint, single ~40 px toolbar, settings popover | T6 desktop +390px bounds/screenshots and actual settings operation |
| HTML/Images separation and imported/direct images | P5 data owner optional kind defaulting old records to HTML, canonical image metadata; P6 image components use img Blob URLs | T7 mixed/nested ZIP and direct image render/classification; wrong formats fail honestly |
| Wrap navigation through collapsed branches | P6 shared filtered organized tree; same order for buttons, keys and gallery | T9 last-to-first/first-to-last, collapsed branches, filters |
| Favorites and named folder moves | P5 additive organization/folders stores; P6 shared actions and picker | T8 move/favorite both kinds, reload, linked HTML still works |
| Selected downloads | P6 original image Blob download and original-path owning-archive resource ZIP; source-only HTML named secondary | T8 actual downloaded file/ZIP byte and hierarchy inspection |
| Preserve existing workspace | P5 additive v2 upgrade, unchanged page/file/archive IDs, snapshot foreign keys and Blob records | T7 existing 19 HTML/seven-capture/selected-ID preservation plus indexed original images |
| Retain original HTML isolation/assets/screenshots | Reuse existing P2 compiler, bridge and capture; kind-aware callers | T1–T5 baseline plus affected resource/capture regression after integration |

The optional kind discriminator gives old records a deterministic interpretation. Creating organizer stores separately avoids rewriting resource paths to implement moves. Image metadata uses existing file IDs, so originals and screenshot page identities do not need replacement. Migration can abort transactionally without resetting the database. Root removal includes organizer cleanup without deleting independent user folders or unrelated roots. Direct image and archive image paths share containment and byte limits, while SVG remains an image-element source rather than parent HTML.

Downloads preserve the owning archive's resource hierarchy instead of serializing instrumented preview HTML. This is the smallest dependable way to retain relative links without speculative resource dependency pruning. No paid provider, content upload, cloud synchronization, new backend, original-file move or new package is required.

### Nonblocking implementation clarifications

**PV3-1 — low: empty groups need a deliberate display rule.** The plan explicitly preserves empty user folders but does not define empty archive groups after kind filtering or after all items move to folders. Keep intentionally empty user folders visible so users can target them. Avoid unrelated empty nested groups for active kind/search/favorites. Preserve a discoverable import-removal action even when all its visible items are assigned elsewhere; hiding a root must not orphan its retained resources. This is an existing R9/R14 interface detail, not a reason to expand scope or ask the user again.

**PV3-2 — info: enforce the HTML capture boundary at callers.** Adding image items to the existing page metadata collection must not pass images into `preparePreview` or screenshot queue. Current/batch screenshot controls belong to HTML mode and HTML-kind targets; native image mode uses original image view/download. T7/T9 and a small guard can verify this consequence of the already specified kind separation.

### Accessibility and verification conditions

The compactness change retains labelled keyboard-reachable buttons, visible focus, native inputs and input-key exemptions. Popover dismissal/focus restoration and hidden mobile drawer focus are in T6/T9. A flat folder picker keeps keyboard behavior tractable and avoids an unrequested hierarchy editor. Images use meaningful names/alt text and object URLs revoked on change/unmount; thumbnail laziness does not replace canonical item identity.

T7 must exercise the live v1 database upgrade without clearing browser data. Counts and selected ID must be captured before/after, and existing resource-dependent HTML and one preexisting screenshot must still open. T8 must inspect actual downloaded bytes, not just a click or toast. T9 must use the same final filtered order for tree, previous/next, keyboard and galleries. Root-owned browser observation remains necessary; no static-source approval substitutes for it.

All 17 requirements map to concrete steps and checks. Ownership prevents overlapping data/App/image-component edits. Original baseline evidence may be retained only where source and behavior remain unchanged; changed App/tree/migration paths need the planned new checks. The current record's reviewed-plan hashes still describe revision2 pending finalization; the parent must stamp these revision3 hashes and pass the same executor admission gate before mutations resume.

### Machine-readable review metadata

```json
{
  "schema": "independent-plan-review/v1",
  "decision": "approved",
  "planRevision": 3,
  "planSha256": "22c89e34ea7e5249b8b38a2cabbea7ff9aa579f5c3110eb5860d9392a509c784",
  "reviewerAgentId": "/root/review",
  "planAuthorAgentId": "/root",
  "sourceBase": {
    "repoHead": null,
    "description": "Existing React/Vite source, initialized Git without HEAD; additive revision to v1 IndexedDB app. Parent browser baseline reports 19 HTML items, four imports, seven captures; reviewer does not claim independent browser counts.",
    "sourceHashes": {
      "src/types.ts": "499b050b95acbb606cb9cebc69d6cdd62801e3937218a728cef456608b76d13e",
      "src/db.ts": "3aea7ed48005372254a7cd8d295578f4c64db55b48f4a2921968534ee3c354b6",
      "src/archive.ts": "ad5c0abe9e079b593aac0e2e4b1570a4f973704f2623e5e58327da47302b1f36",
      "src/tree.ts": "9921dd3d32623590e14b1c59aaab479968b821028e08b984dfacdad03b2db343",
      "src/App.tsx": "e4e735348d441cdcd22b2bd4306ed9c7862f4f26c2fe76b7c752d2991bb088ab",
      "src/components/Gallery.tsx": "3ef3659e35ae06287df5321a68834f3a7329f7375495a188d762a773cb3e2698"
    }
  },
  "createdAt": "2026-10-26T18:07:11.428629+00:00",
  "status": "succeeded",
  "findings": [
    {
      "id": "PV3-1",
      "severity": "low",
      "blocking": false,
      "title": "Define visibility of empty archive groups separately from empty user folders",
      "disposition": "Implementation clarification: preserve intentionally empty user folders and an import-removal route for roots whose items have all been moved; prune unrelated empty nested groups under current kind/search/favorite filters."
    },
    {
      "id": "PV3-2",
      "severity": "info",
      "blocking": false,
      "title": "Capture APIs remain HTML-only after item-kind expansion",
      "disposition": "Filter or guard current and batch capture paths by kind; image mode uses original-image preview/download. No plan scope expansion is required."
    }
  ],
  "usedInputs": {
    "record.json": "28cd66f25392a18db429df92d1bba929b00059f312bc85c513b6db24b9622302",
    "fix-plan.md": "22c89e34ea7e5249b8b38a2cabbea7ff9aa579f5c3110eb5860d9392a509c784",
    "test-plan.md": "e8bd80542af64c1b69e55d1c456166bf0148fc6a71231cf62d07857f7d927b4e",
    "checklist.md": "43aed345eb78e47121b7076cae2ba2a4fa0b10c0820a81113899c9e82ae5c7a3",
    "conversation.json": "96615a785bdbb3b72afa62553fc53143bd1d2816669b693336639abc483199cb"
  },
  "evidencePaths": [
    "fix-plan.md",
    "test-plan.md",
    "checklist.md",
    "conversation.json",
    "record.json"
  ]
}
```

### Implementation clarification accepted by parent

Root confirmed the two nonblocking points after this review: Settings includes compact Manage imports access, so imported resource roots remain removable even when all their items moved or are hidden by kind; shared tree prunes unrelated empty archive/nested groups while retaining empty user folders; capture inputs are strictly HTML-kind items. These preserve existing remove and kind-separation behaviors without changing the approved plan or its hashes.
