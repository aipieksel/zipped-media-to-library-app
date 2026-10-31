# Revision 10 — independent client and account-boundary review

Review date: 2026-10-31. Reviewer: `/root/r10_accounts_architecture`. Workflow: GVR code-reviewer and GVS security-verifier profiles, scoped to code written by the coordinator and the other UI/shared-data agents. This review did not edit those application sources. Browser verification belongs to the coordinator.

## Scope and current disposition

Reviewed `src/FolioRoot.tsx`, the changed `src/App.tsx` shell and Settings integration, `src/settings-route.ts`, `src/account/**`, `AuthPage`, `ProfileSettings`, `AccountsSettings`, `SettingsPage`, and the shared-client lifecycle boundary they invoke. Followed account data through the React gate, cookie-only account client, invite/recovery fragments, asynchronous imports, shared request cancellation, Settings navigation and logout. Also inspected the existing opaque HTML preview boundary because a new credential UI and imported HTML share one application origin.

Three client findings were reported promptly to their authors. All three are repaired and independently reverified for the source snapshot listed below. No unresolved material finding remains within this bounded account/client-lifecycle review. The broader shared metadata implementation has a separate independent reviewer; the coordinator owns final browser and deployed-runtime evidence.

The server authentication modules authored by this reviewer are **not** presented as independently reviewed here. Their independent reviewer and verification are documented separately in `revision-10-server-implementation.md`. During this review the coordinator assigned a separate, authorized implementation repair to the development QA fixture; that finding and native runtime evidence are identified separately below.

## Findings

### F-CLI-01 — asynchronous library jobs could survive logout and use a later session

**Priority:** P2 / medium. **Area:** account lifecycle, data integrity and stale navigation. **Original locations:** `App.tsx` import/export/capture handlers; `shared/runtime.ts` queued writes. **Original App snapshot:** `94c0b5565c9a79f433af645b62a55ad7be98f7c81588ac7234e413c6ff10e492`.

The original App cleanup only set `mounted.current=false`. A library import awaited ZIP extraction or image decoding and then invoked the global `saveImport` without testing whether its App/account lifetime had ended. Capture jobs likewise lacked an unmount abort. The final import callback could still change `window.location.hash`. Separately, shared writes obtained their epoch and client only after their serialized queue callback started, allowing an old queued action to acquire a newly active session.

Reproduction: start a deferred import under synthetic account A; unmount A's App through logout; activate synthetic account B while decoding remains pending; complete the original decode. The original handler calls the shared persistence port and changes the hash under B. Both accounts intentionally share one dataset, so this is stale work crossing an explicit logout boundary, not a claim of different-workspace exfiltration.

Independent executable check extracted the actual `importFiles` arrow function with the TypeScript parser, transpiled it unchanged and supplied deferred decoding plus mocked React setters/persistence/navigation ports. Baseline `c8eb8a4` produced one write under `synthetic-B` and navigation to `images`; the repaired handler produced zero writes and zero navigation after its lifetime was aborted. This is a deterministic function-level check, not a claim of native browser logout testing.

The coordinator added an App lifetime AbortController, ZIP worker termination, capture cancellation, Drive fetch cancellation, and post-await checks before persistence, navigation and downloads. The shared author moved epoch/client capture before enqueue and added checks before work and after cache installation. Independent App check passed for source SHA-256 `9835afcc0e9dd9a430323dc10814ccf85588fb317037dbc8fadef3bbeaa336d5`; extracted function SHA-256 `0c9e9a761abb4da6322f699c03d4c8b3d0238921e44d0f92d4c632050c32417d`.

Independent follow-up extracted the actual `withSharedWrite`, `saveSharedAppearance` and `currentAttempt` functions, held their serial callback until the epoch changed, and verified both operations rejected with `signed-out` before any staged action or network write. The review also identified the same late-service-acquisition pattern in `migrateDataset` after its local read and between the two public migration stages; the author was asked to bind the entire explicit migration to its initial epoch/client.

The migration author added that binding and checks around all asynchronous stages. Independent execution of the actual migration functions changed the active session during a deferred local read and, separately, between Library and Icons. Both rejected with `signed-out` before any encoding/upload or next-dataset call. **Closed.**

### F-CLI-02 — an unbounded shared response could block workspace startup and cleanup

**Priority:** P2 / medium. **Area:** bounded request handling and session transition reliability. **Original locations:** `shared/client.ts` request helper and `FolioRoot.tsx` serialized start/stop. **Original client SHA-256:** `99a36731cdde34a0613a560011d7a35c3350c61fd6387007835d2155cb17790a`.

The original shared fetch had size bounds but no total request/body deadline. FolioRoot queues stop after start. A document response that never finishes therefore leaves startup and the later cleanup queue pending indefinitely. The account client already bounded this case, but the shared client did not. Shared requests also implicitly followed redirects, which made authentication or platform redirects less explicit.

Reproduction boundary: make an initial shared document response leave its body open, then request a session transition. The initial read remains unresolved; without closing the service or a deadline, the serialized stop cannot begin. No special access or malformed payload is needed.

The shared author added a 25-second deadline that remains active through bounded body consumption, clears in `finally`, and aborts the actual fetch/body signal. `close()` still cancels all outstanding requests immediately. Requests now set `redirect:'error'`. Independent execution against the real client used a deliberately stalled JSON body with the request's abort signal and Node's fake clock: the deadline rejected with code `timeout`; a separate immediate `close()` rejected with `signed-out`. The check also asserted `credentials:'same-origin'` and `redirect:'error'`. **Closed.**

### F-CLI-03 — logout failures were invisible on several Settings sections

**Priority:** P2 / medium. **Area:** truthful account feedback. **Original locations:** App's `SettingsPage` call and `SettingsPage.tsx` footer. **Original SettingsPage SHA-256:** `2f297d9c7d99dd5d8c5c26a3038b7a0807a94508eb656e73ef9b9ba0a646f4eb`.

The logout controller correctly retained an unconfirmed session and set `controller.error` when a request failed. However, SettingsPage invoked logout without displaying that error. Profile and Accounts displayed it themselves; AI, Appearance and Workspace displayed only their feature-specific errors. A failed logout from one of those sections therefore left the user on the page without an explanation.

Reproduction: open AI, Appearance or Workspace settings; return a 503 structured account response, or a failed network response, from `/api/folio-auth/logout`; click Log out. The controller records the failure but no account alert appears in those sections. The requested repair is a consistently visible account/logout error in the page shell, without reporting logout success before server confirmation.

The coordinator passes the account error into SettingsPage and renders it with `role="alert"` in the persistent footer. Independent source inspection confirmed the App prop; compiling the actual SettingsPage without CSS and rendering it with React's server renderer confirmed the account failure appears in all five sections and the return-to-workspace href is retained. This establishes component output, not pixel layout. **Closed.**

## Positive boundary evidence

- The private App mounts only after a validated Folio session and shared-storage admission. Account checks that fail validation or cannot complete clear the client identity and return to the gate. Authentication is not inferred from browser storage or the Sites profile.
- Account API calls use fixed same-origin paths, same-origin cookies, no-store, redirect rejection, bounded JSON reads, schema validation and a total 25-second timeout. No browser code reads an HttpOnly session token or persists passwords/capabilities.
- Mutations are serialized by the account controller; session refresh responses have a revision fence and abort superseded reads. `401 credentials` and `403 owner_required` retain the valid account; only explicit signed-out/membership denials clear it.
- Invite/recovery links put capabilities in the URL fragment, bound their format and duplicate parameters, and remove a consumed capability with `history.replaceState`. Generated links use the current origin and root path. The owner-recovery capability remains component memory. No automatic email or clipboard write occurs; copying is an explicit button action.
- Capability displays, account names, error messages and form data are React text nodes, not executable HTML. Imported HTML previews use `sandbox="allow-scripts"` without `allow-same-origin`, plus no-referrer; they do not receive the parent account DOM or credentials.
- The Settings route parser allowlists five exact sections. Profile/account controls use the Folio account schema; direct member navigation to Accounts does not reveal the owner UI, and actual authorization remains server-side. Settings is a normal page with navigation and an account footer.
- Password update behavior checks the resulting server session instead of assuming whether replacement cookies were issued. Profile email is displayed as immutable rather than exposing an unverified address-change flow.
- The account UI distinguishes invitation membership from the outer private Site-access gate and does not claim that an invitation changes Site audience. Original local browser files require an explicit shared migration action.

## Verification and scope limits

`node --import tsx --test tests/account-client.test.ts tests/settings-route.test.ts` passed both files; these contain nine account-client behavior checks and one Settings-route check. They cover cookie/request settings, safe response schemas, denied-session error discrimination, bounded responses, unconfirmed mutations, recipient fragment links and field bounds. The independent delayed-import check described above passed after repair.

This review does not claim real hosted credential setup, a teammate's production login, browser visual/a11y completion, provider inference, or complete backend security coverage. It also does not claim to exhaustively review the shared metadata packing/codec work while that author is still completing it. The coordinator owns native browser evidence and deployment verification.

## Separate QA/runtime concurrency repair

The coordinator's managed browser exposed 503 responses at initial shared workspace startup. Sequential fixture document reads passed; making the same three reads concurrently reproduced the failure in actual workerd/D1. The SDK's installed `@better-auth/core` conditional export selected `async_hooks/pure.index.mjs` under esbuild's browser platform. That browser fallback holds one global context and is unsuitable for simultaneous Worker requests. The package exposes a native `workerd` condition before `browser`.

At the coordinator's explicit request, this reviewer repaired their own QA fixture/test bundle with `conditions:['workerd']`; the coordinator applied the same configuration to the production Worker build. This was an implementation/debugging task, not an independent review of this reviewer's QA source. Authentication logic, credential hashes, schema and authorization rules were not weakened or changed.

The QA fixture now checks all three empty document reads concurrently. The native Worker regression checks that the bundle selects native async_hooks and excludes the pure browser variant, then runs three rounds of concurrent document and distinct owner/member session reads. Both passed in actual workerd with native D1/R2 and synthetic accounts only. Root must restart its managed preview to replace the old in-memory fixture bundle. Production node compatibility and actual deployed cookie behavior still require their own evidence.

## Final closure and source identity

Disposition for this snapshot: **F-CLI-01 closed, F-CLI-02 closed, F-CLI-03 closed**. The account UI author confirmed no further account-source changes were planned. These hashes identify the reviewed working-tree sources after the coordinator's `6c0f38b` checkpoint plus the documented repairs. Later changes to the listed boundary functions require a focused delta check before reusing the receipt; this is not a blanket approval of future edits.

| Source | SHA-256 |
|---|---|
| `src/FolioRoot.tsx` | `daa173c2db5684ba419b99ddc5584740c384f5866e31998f05838c15afb9eb81` |
| `src/App.tsx` | `8d86caa0c0e7ee186fa9f460a74da1e303c25f8d3a1d2b33c857918cff704b41` |
| `src/settings-route.ts` | `0621af7b7a3c0b290a24a1d223f69f3a7b7337ba6605dab33460b5367595bc29` |
| `src/account/client.ts` | `bfd2953ff978e48bd21d2b4ced522a2a58febe01934a4f37e7aaf02b60273136` |
| `src/account/contracts.ts` | `6fd8b044e5d6d8a4b979a5b58b9d215f9312314add73fcf4a036a10d1e420e1f` |
| `src/account/routes.ts` | `96956d62c9833e6a535c08993afff2f9c85f553cd3910be15b4c36b62432a5bb` |
| `src/account/useFolioAccount.ts` | `92ed59225e83b4c9386d7c3969556b34075703eea79373eb64e4277646e19a78` |
| `src/components/AuthPage.tsx` | `6d87b3237d0b710d9ce418cc0ee4edec20443c2ca2db166509ae07d775237427` |
| `src/components/ProfileSettings.tsx` | `b0d188bdf31f19bfbccb321940363603813ba689ce2d735777d87fdd14f884d3` |
| `src/components/AccountsSettings.tsx` | `bb516c4033011a8b00b4aeabd509a23a38b18fbb76ae7fbb95393e6958e752de` |
| `src/components/SettingsPage.tsx` | `ab70ca5a39d5c89198ff5957353a3429f00075ee7c513b48a954ece8a99d3047` |
| `src/shared/runtime.ts` (lifecycle boundary) | `2a9b0ea161d2c633d0bbddae5c7b040c96dd8bf3cf37b78a4532a9364567af31` |
| `src/shared/client.ts` (request boundary) | `163a80573fcd6da0bf84ee16ac9d947fbf378bfea1ba77c7f3348b59c46e633d` |
| `src/shared/migration.ts` (session binding) | `da34ab450a7eee930e67de1095da83109360b2187882c980bc9aaa3e0cd83bde` |
| `scripts/build-worker.mjs` (native conditional export) | `fb23645d7ffad2f5206950d4065c08cf231c03fad0c7c5ee0a2def349383028a` |

The review's deterministic reproductions execute actual source functions with controlled asynchronous ports, and its Settings check uses the actual compiled component. They complement the coordinator's native-browser checks; they do not replace them. The reviewer performed no application-source, Git or deployment mutation for these three client repairs. The separately authorized QA fixture/configuration repair is disclosed above.

## 2026-10-31 accessibility delta revalidation

Preserving the earlier snapshot above, the coordinator's subsequent UI repairs were independently checked under the same review boundary. App changed its closed-select Escape delegation; Settings now scrolls on short viewports and keeps mobile logout/errors in normal flow; footer errors use the readable theme token. Profile/Accounts changed section-heading levels only. `FolioRoot`, `AuthPage`, and all `src/account/**` hashes are unchanged. No authentication, credential, capability or account-request behavior changed. Actual handler execution and component markup checks are recorded in `revision-10-a11y-review.md`; native browser evidence remains separate.

The following hashes supersede the corresponding earlier UI entries and the explicitly scoped shared-boundary entries:

| Source | SHA-256 |
|---|---|
| `src/App.tsx` | `083a9699bcb2715093c4c9b79b30cbdf6f7bdb069112ac243c7970089ea03951` |
| `src/components/ProfileSettings.tsx` | `49b3b5ffbc1db550c93dbeec42c0e3212ece7b346e031c0b50b46d24cf74800f` |
| `src/components/AccountsSettings.tsx` | `6fb6a162b17e8dd7c478bc87329ad645ecc0a47bb91789544740e2a181ccf32b` |
| `src/components/SettingsPage.tsx` | `ab70ca5a39d5c89198ff5957353a3429f00075ee7c513b48a954ece8a99d3047` |
| `src/shared/runtime.ts` (lifecycle boundary) | `2a9b0ea161d2c633d0bbddae5c7b040c96dd8bf3cf37b78a4532a9364567af31` |
| `src/shared/client.ts` (request boundary) | `ebbeb13ecd28661fbde8ef09d25dc49097dc095dd2c8d32d13a1b2c4086a131d` |
| `src/shared/migration.ts` (session binding) | `4c460ff2ba2f9bd1e3c09970f919f7e6dffa9208d0437257db1664d887172884` |

The shared request timeout/close boundary and migration epoch binding were reread after the shared author's later metadata/filename corrections. Those controls remain intact; the broader shared source has its own independent `revision-10-shared-review.md`. Current request-boundary hash: `src/shared/client.ts` = `ebbeb13ecd28661fbde8ef09d25dc49097dc095dd2c8d32d13a1b2c4086a131d`; current migration-binding hash: `src/shared/migration.ts` = `4c460ff2ba2f9bd1e3c09970f919f7e6dffa9208d0437257db1664d887172884`. Runtime lifecycle hash remains `2a9b0ea161d2c633d0bbddae5c7b040c96dd8bf3cf37b78a4532a9364567af31`. These scoped rebindings do not claim an additional exhaustive review of the packing/codec implementation.
