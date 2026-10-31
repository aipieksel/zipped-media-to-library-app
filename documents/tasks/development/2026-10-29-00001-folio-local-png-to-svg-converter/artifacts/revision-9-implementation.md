# Revision 9 — implementation and verification checkpoint

Date: 2026-10-31. Execution owner: /root; attempt ai-1. Same reviewed revision 9,
request provenance and admission hashes. No new product scope was introduced.

## Delivered code

- Shared typed AI service and settings controller, with explicit pairing and
  generation only. Provider/model/reasoning preferences persist; pairing credentials
  stay in tab memory. Codex uses the local ChatGPT account without API-key fallback.
- Adapted source-only supplied `@codraoss/ai-cli-integration` package and a separately
  built Node companion. Exact Origin/Host, bearer pairing, bounded payloads and
  subprocesses, strict effective configuration checks, cancellation and cleanup.
  The companion cannot run arbitrary user commands or model tools.
- Same-page Icons reconstruction/cleanup with a source-aware prompt, native PNG
  attachment, separate editable SVG candidate, strict XML validation and actual
  native RGBA comparison. Selected Images use the same workflow. General raster
  editing is not claimed by this SVG adapter.
- Independent Saved icon records with immutable source/base snapshots, additive
  IndexedDB migration, transaction/revision guards, explicit save/delete, preserved
  folder/favorite/search behavior and current-color SVG/ZIP exports. Recolor changes
  the actual SVG and invalidates old fidelity evidence; reset restores exact base.
- Existing shared sidebar and top tabs retained. Convert/Saved remains in the
  toolbar. Compact global menu and Settings AI/Profile tabs use the shared native
  modal. Narrow dialog scrolling and keyboard focus issues observed in QA corrected.
- Real Sites account boundary with private uncached identity endpoint and the
  platform's sign-in/out routes. Local display-name preference; password/security
  management belongs to the provider. No password database or invented login.

## Review and corrections

Independent plan, account, companion and application/security reviews are retained
in this task's artifacts. Companion C1–C4 close missing tool restrictions,
ChatGPT-only invocation enforcement, obsolete official CLI configuration and
effective layer precedence. Application F12–F15 close bounded status reads and
cancel, original source MIME admission, toolbar focus and candidate announcements.
The recorded reviewer/implementer roles are explicit; an executor's test run is
not represented as an independent review of their own code.

## Verification

| Gate | Outcome | Evidence |
| --- | --- | --- |
| Complete existing npm test, including privacy hooks | 293 passed, 0 failed, 1 optional existing fixture skipped | revision-9-unit-verification.md; revision-9-npm-test-output.txt |
| Independent core/HTTP review run | 19/19 passed | revision-9-companion-review.md |
| Official Codex CLI 0.166.0 isolated compatibility probe | Strict flags/config RPC accepted; this host's mandatory managed hooks correctly reject fixed-purpose inference | revision-9-companion-review.md |
| Native saved-storage checks | 6/6 passed | revision-9-e2e-verification.md |
| Native source MIME checks | 2/2 passed | revision-9-e2e-verification.md |
| Actual application UI with declared no-provider fixture | Candidate/save, cancellation, unsafe-output rejection, Images entry, recolor/reload, keyboard and narrow layout passed as listed | revision-9-e2e-verification.md; revision-9-browser-ui-observations.json |
| Final production build after dialog/settings corrections | Passed: privacy scan 255 tracked source files, TypeScript, Vite 1,738 modules, Worker embedding 12 assets | Root npm run build, 2026-10-31, exit 0 |
| Companion build/CLI help | Passed | revision-9-companion-review.md and prior execution notes |
| Actual user's account and attached-image inference | Not run; local activation required | R29 remains open |
| Actual signed-in Site profile/sign-out | Not run; current browser at sign-in wall | R34/R35 live boundary remains open |
| Private production publication | Pending this source checkpoint | Recorded in the release artifact after the native operation |

The final web build produced main JS 789.66 kB (249.35 kB gzip) and CSS 54.64 kB
(10.98 kB gzip). Existing mixed static/dynamic import and large-chunk notices are
warnings, not build errors. No broad performance claim is made.

## Durable milestones

| Milestone | Pushed GitHub commit |
| --- | --- |
| Assessment and requested scope | 939688e0a514cd2aa03c8b06af8daf06cf3a7d6d |
| Reviewed plan, real account/profile implementation and dependencies | 7510a43a992c50976646e7cb5f309c18cf38f6b6 |
| Independent Saved artwork and color variants | 687fa556afdfabaf98ce31bf11467ce9f9e8a539 |
| Shared AI companion and SVG studio | 59b60c9366785c2a3fb815bb74289240eb413503 |

Each GitHub tree was checked against the corresponding local Git tree. Final UI,
fixture and verification artifacts follow in the next pushed checkpoint. Main and
the existing owner-private Site will be updated without force or audience change.

## Remaining activation prerequisite

The user's local computer must have Node 22+, official Codex 0.166.0 signed in via
ChatGPT, and the Folio companion running. The owner then signs in to the private
Site, pairs in Settings → AI, runs the explicit text test and generates an SVG
from an image. This environment cannot start a process on the user's Mac or
provide their login. No fixture, catalog response or isolated CLI probe replaces
that required end-to-end account test.
