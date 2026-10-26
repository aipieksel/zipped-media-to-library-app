# Revision 3 plan review

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
