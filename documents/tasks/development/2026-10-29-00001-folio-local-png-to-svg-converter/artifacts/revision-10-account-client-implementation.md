# Revision 10 — P16 delegated account client and forms

## Scope and ownership

Implemented the admitted account client and UI against `artifacts/revision-10-http-contract.md` and the current `worker/auth.mjs`. The coordinator owns App/main integration, the authenticated content boundary, shared-view cleanup, Settings routes, global CSS, packages, build, Git and release. The server owner owns account enforcement and its independent Worker tests. No production account, password, invitation, recovery token or session was created by this work.

## Files

- New `src/account/contracts.ts`: typed, validated account/session/member/invitation/capability responses and input constraints.
- New `src/account/client.ts`: fixed same-origin HTTP endpoints, cookie credentials, no-store requests, rejected redirects, bounded JSON responses, safe typed errors and no browser credential storage.
- New `src/account/routes.ts`: bounded `#login`, `#register` and `#recover` parsing; capability links use fragments; consumed capabilities are removed from the current history entry.
- New `src/account/useFolioAccount.ts`: one shared controller above the authenticated App; serialized actions; abort/stale-read handling; session refresh on visibility/pageshow.
- New `src/components/AuthPage.tsx`: real loading/error/login, trusted-owner bootstrap, invitation registration and capability recovery forms. Owner recovery is a deliberate button action, never a page-load request.
- Replaced `src/components/ProfileSettings.tsx`: actual Folio profile update, read-only sign-in email, verified current-password change and logout. Removed the old local-display-name preference and ChatGPT-password navigation from this UI.
- New `src/components/AccountsSettings.tsx`: server-backed owner member/invitation lists, copy-link invitations, revocation, disable/restore actions and password-confirmed member recovery. No fake email delivery; private Site access is explicitly separate.
- New `src/components/account.css`: compact forms, account rows, link panels and responsive auth page using the shared semantic color variables.
- New `tests/account-client.test.ts`: focused synthetic client/contract/route checks.

No App/main/shell file was changed by this delegate. No new dropdown is introduced by the account forms.

## Integration API

Import `useFolioAccount` and `FolioAccountController` from `src/account/useFolioAccount.ts`. Mount the hook once above authenticated workspace contents. All three components accept `{controller: FolioAccountController}`.

The controller exposes `status: 'loading' | 'ready' | 'error'`, `state: FolioSession | null`, `account`, `busy`, `error`, `notice`, `clearError`, `refresh`, `login`, `bootstrap`, `register`, `logout`, `updateProfile`, `changePassword`, `recover`, `loadAccounts`, `createInvitation`, `revokeInvitation`, `setMemberStatus`, `createMemberRecovery`, and `createOwnerRecovery`.

Ordinary mutation methods resolve boolean. `loadAccounts` returns `{members,invitations} | null`; capability-creation methods return `{token,email,expiresAt} | null`. `updateProfile` accepts the name string. `setMemberStatus` accepts `(id, 'active' | 'disabled')`; `createMemberRecovery` accepts `(id,currentPassword)`. Other credential methods accept the exact named object from the HTTP contract. No method expects or returns a reusable browser authentication token.

`parseAuthRoute(hash)` and `isAuthRoute(hash)` let the coordinator route explicit invitation/recovery URLs to AuthPage even when an existing account is signed in. A successful ordinary login retains the existing non-auth workspace fragment; successful registration replaces its consumed route with `#html`; recovery replaces its consumed route with `#login`.

The coordinator should require verified ready/account state before mounting private workspace contents and react to `account` becoming null after logout/session denial/recovery. Abort and remove shared views/object URLs through the existing integration owner. A failed account check clears the controller's verified account rather than granting access from stale session state.

## Session and password semantics

The server owner clarified that the current password route atomically revokes all old sessions, then creates a replacement current-browser session and returns its cookie. The client rechecks `/session` after the password request, so it also handles a server response that leaves the browser signed out. It does not assume the old cookie survived. Password-change success remains acknowledged if the subsequent session check cannot be confirmed.

Only `401 signed_out` and `403 membership` explicitly end the current client account during ordinary account actions. A wrong current password (`401 credentials`) and an owner-only permission failure (`403 owner_required`) preserve an otherwise valid session. Recovery consumption shows Login. Owner-bootstrap and logout refresh the current trusted Site setup/recovery flags.

Capabilities remain in transient component state and generated fragment links. The owner sees a new link only after a successful server response. Dismissing a link or leaving its page removes that displayed value; revoking or disabling the relevant account clears displayed links that are now unusable. Clipboard failure offers manual selection/copy without inventing success. No email is sent.

## Actual checks

| Check | Result |
|---|---|
| `node --import tsx tests/account-client.test.ts` | **9 tests passed**, 0 failed; explicit individual test output observed. |
| Focused TypeScript program using parsed repository compiler options over four account modules, three components and the new test file | **0 diagnostics**, exit 0. |
| `git diff --check` on the owned source/test paths | **Passed**, exit 0. |
| Source search for localStorage/sessionStorage/indexedDB/setPreference, legacy `/api/account`, external ChatGPT profile links and native selects in the new account modules/forms | **No matches**. This is a source observation, not a browser-memory or server-security proof. |

The tests cover same-origin/no-store/redirect-rejecting request behavior, normalized email payloads, stripping unexpected returned credential fields, malformed session identities/fixed auth paths, distinction between bad credentials and revoked membership, structured safe errors, route-ID traversal rejection, JSON DELETE, rejected HTML/oversized responses, honest unconfirmed-mutation errors, bounded fragment parsing and server-aligned name/password limits. All identities, tokens and passwords in tests are synthetic fixtures.

The `--test` child-process invocation in this runtime reported only the test file as one aggregate; the direct `node --import tsx` invocation above was additionally run and showed all nine named tests. No aggregate count was treated as evidence for unobserved cases.

## Remaining coordinator evidence

The coordinator still needs to integrate the gate/components, verify actual forms and routes in a browser, exercise real server-cookie flows with isolated test identities, test current-session replacement/full revocation and logout shared-view cleanup, and check responsive/focus/contrast states. This delegate did not run a broad build, create a production credential, access a live AI account, commit/push or deploy. This receipt does not close P16/T27 or prove shared-data behavior.
