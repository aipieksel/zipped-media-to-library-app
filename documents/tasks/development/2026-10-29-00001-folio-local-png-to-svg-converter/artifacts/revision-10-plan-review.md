# Revision 10 — independent plan review

## Verdict: APPROVED after two plan corrections

The current revision 10 plan is ready for the coordinator's criticized finalization and execution-admission check. Two concrete omissions were reported to the coordinator, incorporated in P16/T27 and the plan/test appendices, and independently reread before this approval. **Fixed in plan does not mean fixed in application code.** No code was implemented or tested by this review.

| Metadata | Value |
| --- | --- |
| Schema | Markdown independent plan-review artifact, version 1 |
| Run / stage | folio-revision-10 / review-plan |
| Plan revision | 10 |
| Reviewer | `/root/r10_design_research`, independent of planner `/root` |
| Source baseline / actual HEAD | `bdf73305ff51dcd59c2b7c9a94a66501845ca560` |
| Final reviewed snapshot | 2026-10-31T18:14:05.127786+00:00 |
| Status | APPROVED; critique outcome revised; coordinator readiness stamping pending |
| Record | `documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter` |

### Final reviewed SHA-256 values

| Input | SHA-256 |
| --- | --- |
| `record.json` | `20e9b6fd4b4ba8eda807cc6a1aa8e9bef6c97d388f758329d01a7159be00ba99` |
| `fix-plan.md` / plan inputHash | `8d96e81a25d40d65ad87427236ed4aab457b9911865c165dc6235e9b85ade503` |
| `test-plan.md` | `3c56115bba24e83b3366aad75091650218f89eeaf32891682d019fe86936cbb2` |
| `checklist.md` | `3a263b23f4f63abae3e3a234989ba6aa7f7f6b5f60497a23387d1359c21c145d` |
| `critique.md` before coordinator reconciliation | `a2f5f2b9af75bddfa98f572ea8166f8366d20f55a6f6d4e33033eb7c88a8fd91` |
| `results.md` before coordinator reconciliation | `7eb6a524c49bcb403a1447d5982545a37b83cf4b7aa7d103ee004c7092ba18f0` |
| `artifacts/revision-10-ui-assessment.md` | `b7d677da03691c258f2c6b926a555d836190ee5cb559efbf93b58ff16cbbcb34` |
| `artifacts/revision-10-ui-research.md` | `f61b3f4f2764c2ef670d49eace3175889a7ede6b117b2132e3bb3eb4c29fe44e` |
| `artifacts/revision-10-account-architecture.md` | `fac688e2c35d21c874310ba9c7f6823496f1f9b8bf8dee78de39bc88fc9b64ff` |

Initial reviewed plan hash was `6eecf6a88a98744907617525d798bf1b5b7382530faded26bd396e5a7de39623`, and initial test-plan hash was `e994cb04bad7fb097d279e3c085283f404a88d9f89429a426f91d08f14319a24`. These were superseded by the final values above after the following corrections. Readiness metadata updates should preserve these reviewed content hashes; a material further plan change requires another affected-scope review.

## Findings and disposition

### F-R10-01 — Protected media caching must respect logout

**Severity:** high. **Authority:** S5 requests real login/logout “for security”; R8/R34/R40 require protected shared data. **Affected implementation/check:** P16, P17, T27, T28.

**Evidence:** `worker/cloud.mjs` currently changes file/image responses to `private, max-age=31536000, immutable` in `resourceResponse` and `imageResponse`; image responses also support ETag-based 304 and HEAD. `worker/index.js` dispatches collection reads before static assets. The initial plan required membership guards and session revocation but did not change the long-lived browser cache policy. Previously fetched private media can be reused without a new authorization request, so a server-only denied-request test is insufficient evidence for the logout boundary.

**Smallest correction:** protected media responses must use a revocation-compatible cache policy; include GET, HEAD and conditional responses, remove rendered shared content/object URLs on logout, and retain original device-only imports. Exercise previously fetched resources after logout as well as direct denied requests.

**Disposition:** **fixed_in_plan**. P16 now explicitly requires `private,no-store` for protected responses including HEAD/conditional requests, with UI/object URL cleanup. T27 and its appendix add cached-resource/logout and header assertions. T28 retains logout/back-navigation evidence. This requirement addresses the application/server behavior; it is not a claim to erase files a user previously downloaded or to remotely revoke already acquired bytes.

### F-R10-02 — Recovery needs explicit authority and decisive tests

**Severity:** medium. **Authority:** R35 promises honest recovery while S5 requests independent Folio accounts; preserving access must not depend on a fictitious reset email or provider-password link. **Affected implementation/check:** P16, T27.

**Evidence:** the initial plan said “owner-controlled action with single-use reset capability” but did not distinguish an authenticated owner's member-reset authority from a locked-out owner's recovery authority. Initial T27 covered password change, not recovery permission, expiry, replay or reset-session revocation. The architecture artifact identified the configured trusted Sites owner as a real separate identity boundary and warned against unguarded recovery or invented email delivery.

**Smallest correction:** explicitly identify who may create each kind of reset capability and add negative as well as successful consumption tests.

**Disposition:** **fixed_in_plan**. P16 now specifies current-password step-up by an authenticated owner for member recovery, and the configured trusted Site owner for owner recovery. Reset tokens are recipient-bound, expiring, hashed at rest and single-use; password replacement revokes account sessions. T27 now tests authority, binding, expiry, replay, changed-password login and previous-session rejection. No outbound email or production account creation is introduced.

## Source and scope reconciliation

The review read the current S5 source, current R/P/T mappings and checklist, the three revision-10 evidence artifacts, critique/results history relevant to the current amendment, and relevant application source. Source checks included `worker/index.js`, `worker/account.mjs`, `worker/cloud.mjs`, `.openai/hosting.json`, the storage API inventories in `src/db.ts` / `src/icon-collection.ts` / `src/useIconCollection.ts`, and the UI owners inspected in the research report.

| Requested outcome or retained boundary | Concrete planned delivery and decisive check | Review conclusion |
| --- | --- | --- |
| Workspace dropdown above search, same tree and full-height sidebar, footer Settings | P15 / T26; existing App/ArchiveTree ownership, topbar height removed | Covered; do not create another Icons sidebar |
| One custom dropdown across the app | P15 / T26; all 19 current selects plus workspace switcher | Covered; preserve numeric values, dynamic AI choices and trigger refs |
| Convert/Saved labels/counts remain one line | P15 / T26; atomic control with outer-toolbar reflow | Covered; verify populated and large counts at narrow widths |
| Settings page with left navigation and right content | P15 / T26; explicit hash routes, Back/reload, mounted controllers, return workspace | Covered; navigation links have current-page semantics |
| Native-dialog and nested-popover behavior | P15 / T26; closest-dialog portal, parent-dismissal/global-shortcut coordination | Covered; actual keyboard/pointer evidence is required |
| Genuine app accounts separate from AI identity | P16 / T27; D1 credential/session/membership records, trusted owner bootstrap and bounded invitations | Covered; private Site gate is retained and distinct |
| Same files and organization for all members | P17 / T28; server-derived singleton workspace, D1 metadata and R2 bytes, two isolated clients | Covered; two tabs using one IDB are insufficient evidence |
| Existing local data remains recoverable | P17 / T28; explicit inventory/review migration, stable identities, staged blobs, acknowledged commit, idempotent retry | Covered; no automatic historical-media upload or deletion |
| Appearance controls remain coherent | P18 / T29; one validated shared palette, local draft, save/reset, semantic surfaces | Covered; rendered dark/vivid states and unchanged artwork bytes required |
| Existing PNG/WebP/AI behavior and truthful verification | P19 / T30 plus retained conversion evidence | Covered; shared persistence must preserve provenance and explicit AI sends |
| Frequent durable checkpoints and same Site | P14/P20 / T31 | Covered; coordinator owns Git, build, migrations and publication |

Shared persistence is a substantive but authorized consequence of S5's “everyone sees the exact same thing, the exact same files.” The chosen single workspace, bounded polling, immutable uploads and revision checks are proportionate; the plan excludes speculative multitenancy or realtime infrastructure. A recovery path and protected-response cache policy are necessary details of the admitted account boundary, not new customer-facing product areas.

## Execution boundaries and evidence conditions

- P15 UI work is independent of production owner-password activation. P16 has a bounded Better Auth Worker/D1/cookie/hash compatibility gate; a failed gate requires a focused alternative review, not invented compatibility or a weak password-hash fallback.
- The user has authorized implementation. Lack of the owner's password, an identified teammate or live AI companion does not block implementing and testing unrelated work with isolated synthetic identities. It does limit what can be claimed as a completed hosted account journey or R29 real inference.
- P17 requires server acknowledgement, complete uploaded dependencies and explicit conflicts. A local-cache write alone is not shared success. Preserve the existing R2 catalogue and source blobs.
- The repeated appearance/auth/shell paths in broad P-step mappings are coordinator integration paths. Concrete delegated file ownership must stay disjoint, as the plan already requires; only the coordinator installs dependencies or runs the release build.
- T26/T29 require real rendered desktop/narrow UI evidence. Typecheck, native-select source count and a successful bundle do not establish layout, focus, contrast or popup operation. The finite viewport/state matrix is in the referenced UI artifacts.
- Checked historical conversion outcomes remain historical evidence. The newly planned T28 assertions, including Uncategorized persistence, must pass against the shared adapters before claiming the new shared workflow complete.
- This approval is a plan review only. Source code, credentials, account records, data migrations, Site access and deployment were not changed by the reviewer. The coordinator must reconcile critique metadata and run the actual admission helper; this artifact is not a fabricated host queue receipt.

No unresolved material plan finding remains at the final hashes above.
