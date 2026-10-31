# Revision 10 — accounts and shared workspace architecture

Date: 2026-10-31 UTC. Author: `/root/r10_accounts_architecture`. Baseline: `bdf73305ff51dcd59c2b7c9a94a66501845ca560`. Stage: GAA architecture advice, with database and security specialist review. This is an assessment and implementation contract, not evidence that accounts, shared writes, migrations, or a second-user journey have shipped.

## Decision

Implement real Folio accounts, authenticated on the server, and one shared workspace whose files and metadata are authoritative in server storage. Keep the existing Site and its audience unchanged. The user's explicit request for app registration, login/logout and password settings must not be reduced again to a browser preference or a presentation of the current ChatGPT profile.

There are two separate access boundaries. Sites dispatch currently permits only the Site owner to reach this Worker; Folio can additionally require its own registered account and session. Adding an app account does not change the outer Sites access policy. A teammate will need both a permitted Site identity and an authorized Folio account until the user explicitly chooses a different supported hosting/access arrangement. No teammate identity has been supplied, so no account, email invitation, or audience change should be invented during implementation.

Native Sites identity plus Folio membership records is the least complex supported platform integration, but it remains ChatGPT-backed login. It does not fully satisfy a request for independent Folio email/password accounts. A genuine additional Folio credential layer is a reasonable implementation of the user's explicit instruction, subject to verification of its cookie handling, Worker compatibility, database deployment and recovery path. Preserve Sites' own authentication endpoints and session; do not replace or impersonate them.

## What exists now

| Boundary | Evidence in baseline | Consequence |
|---|---|---|
| Site authentication | `worker/account.mjs` validates trusted dispatch identity headers and returns them through read-only `/api/account`. Sign-in and sign-out navigate to Sites-owned paths. | No Folio registration, password, account table, membership, session revocation or user management exists. |
| Profile | `src/components/ProfileSettings.tsx` displays the ChatGPT name/email. Its editable display name is an IndexedDB preference. Password/security links leave Folio for OpenAI account management. | The previous implementation was honest about its limited scope, but the user's new requirement is materially different. |
| Server files | `worker/cloud.mjs` serves a validated R2 catalogue from `folio/collection.json`, content-addressed objects, manifests, image variants and streamed file slices. | The existing server collection is already one shared collection, not a user-owned collection. Keep these object identities and URLs stable. |
| Server authorization | Collection reads depend on the existing owner-private Sites boundary. Administrative uploads use `FOLIO_INGEST_TOKEN`, Origin checks, checksums and bounded payloads. | Before any audience expansion, protect every collection read and write with active Folio membership. Never expose the ingestion token as a browser user credential. |
| Browser library | `src/db.ts` stores imported HTML/images/blobs, folders, organization, snapshots and preferences in `folio-workspace` IndexedDB. `syncCloudCollection` adds remote catalogue metadata to that browser. | Two account logins in different browsers will not see each other's locally imported files merely because both signed in. |
| Icons | `src/icon-collection.ts` stores conversions, original raster sources, SVG outputs, folders, preferences and saved icon artwork in separate IndexedDB stores. | Saved icons currently persist on one browser, not across teammates or devices. Preserve the existing revision/stale-result protections when adding sync. |
| Hosting | `.openai/hosting.json` declares the existing project and `BUCKET`; no D1 binding is present. `scripts/build-worker.mjs` packages embedded frontend assets and the Worker. | A real account database requires additive database binding/schema/migration packaging; a login form alone cannot supply it. |

This assessment did not open or emit private media. It inspected source, tooling contracts and prior task evidence only.

## Platform contract and authority

The installed Sites `references/identity-and-secrets.md` says Sites owns hosted authentication and its `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback` routes. Requests from an authenticated visitor carry the stable per-Site user ID and display attributes. Service-access tokens do not establish a visitor identity. Application sign-in and workspace membership are distinct, and server-side membership checks are appropriate when needed. Moving the same Worker outside dispatch would require replacing the trusted-header assumption; arbitrary raw request headers are not authentication.

The Sites `references/storage.md` specifies D1 for structured shared product records and R2 for files. Browser storage is suitable for device-local preferences. Logical `d1` and `r2` bindings belong in `.openai/hosting.json`; preserve `BUCKET`. Schema changes require generated, committed, bounded migrations, applied separately to local and hosted databases. Do not create tables during normal request handling. The existing Worker-ESM build does not yet package D1 migrations; verify and implement that packaging before claiming deployment has created account tables.

The Sites access tool can update an explicit audience and can send invitation emails when named viewers are added. Neither a public audience nor an actual teammate recipient is authorized by the current request. Preserve the owner-private audience while implementing the account feature. The owner's request to support account creation authorizes building registration; it does not provide a teammate's address or authorize emailing anyone.

## Account design

### Preferred implementation for the explicit request

Use an established Worker-compatible authentication implementation for Folio credentials and opaque server sessions. Better Auth is a concrete candidate: its official repository documents native D1 support, and current documentation provides email/password registration, login, logout and cookie configuration. This assessment has not installed, bundled or security-reviewed a pinned version. Its compatibility with this particular browser-platform esbuild Worker bundle must be proven; do not assume a Node-only dependency will work. Preserve the current framework rather than rebuilding the app for the authentication library. [Sources: Better Auth 1.5 D1 announcement, email/password and cookies documentation below.]

Make the compatibility check narrow: a locked stable dependency version, production Worker build, local D1 registration/login/session/logout test, and a permitted deployed test of `Set-Cookie` round trips through Sites. Do not choose a beta because it appeared in search results. If the package needs Node compatibility flags not supported by this Site packaging, determine supported alternatives before adding inert auth UI.

For an execution plan, the preferred initial combination is Better Auth's native D1 integration and opaque database-backed sessions, with a fixed same-origin `/api/folio-auth` base path. Disable unguarded generic signup and route registration through the owner/invitation checks described below. Do not trust a registration hook to grant membership unless the final ownership/invitation transition is enforced by database constraints. A failed or concurrent registration may leave an inactive account to clean up; it must never grant an unauthorized membership.

Hash compatibility deserves an explicit check: Better Auth documents a default scrypt hash and a custom hash/verify hook. Cloudflare's current Node-crypto documentation supports scrypt with its Node compatibility runtime, but not native Argon2. Verify the actual Site compatibility date/flags rather than inferring them from the current date. Select an OWASP scrypt parameter profile that fits the Worker memory budget and measure it under the real runtime. If native Node crypto cannot be used, WebCrypto PBKDF2-HMAC-SHA256 at at least 600,000 iterations, a cryptographically random per-password salt and a versioned encoding is a candidate fallback to validate, not permission to lower the work factor to fit an unknown limit. Do not silently fall back to a fast hash. Keep algorithm/parameter parsing and comparison strict and use the library's supported hook rather than forking its session implementation. [Better Auth email/password; Cloudflare Node crypto and Web Crypto; OWASP Password Storage]

Keep the credential implementation behind a small `auth` service so a future hosting/provider change does not alter library code. Separate:

- The authenticated Folio account and its server session.
- The active membership/role in the single Folio workspace.
- The optional trusted Sites identity observed at the outer gate.
- The independently paired AI companion/provider account on the current device.

An AI provider token, ChatGPT subscription connection, companion bearer token, R2 ingestion token or browser-local display name must never establish Folio membership.

### Registration and owner bootstrap

Offer a real registration form, but do not let an arbitrary first anonymous request become workspace owner. Bind one-time owner initialization to a server-configured, verified Site-owner identity or a separately provisioned, single-use server bootstrap credential. Require the owner to enter their own password; never invent a production password or record it in repository evidence. Enforce owner creation and bootstrap consumption atomically with unique constraints.

For subsequent accounts, use owner-approved membership or bounded single-use invitations. A registration can create a pending member without granting any collection bytes. Only an owner may activate it. If a copyable invitation link is provided, keep only a hash of its high-entropy token, bind it to the intended recipient/role, expire it, and consume it once. Do not send email without the user's separate explicit request. Do not expose a public self-registration flow that immediately grants access to this private shared collection.

The application must explain that a teammate also needs access to the hosted Site. Do not claim an application invite automatically changes that platform policy.

### Password/session contract

Registration, login and password changes run on the server. No passwords or session tokens belong in localStorage, IndexedDB, URL parameters, committed fixtures, frontend environment variables or log output. Use the authentication package's supported slow salted password hashing and benchmark it on the actual Worker runtime. OWASP recommends modern slow password hashing; ordinary SHA-256 is inappropriate for passwords. [OWASP Password Storage]

Use a distinct app cookie name, `Secure`, `HttpOnly`, explicit `SameSite`, no broad Domain scope, and a fixed same-origin redirect allowlist. Check Origin/CSRF protections for authenticated mutations; SameSite is defense in depth rather than the entire CSRF boundary. Rotate sessions when authenticating/changing sensitive account state, revoke on logout and membership disable, and limit session lifetime. Avoid client-only session caches that retain revoked permissions. [OWASP Session Management; Better Auth Cookies]

Implement authenticated password change with the current password and revocation of other sessions. A password-recovery link requires a real delivery/recovery mechanism; do not display success for an unsent reset email. A managed identity/recovery provider can be added if required, but no provider credentials or outbound-mail setup are currently present. A documented owner recovery path is required before calling the account system production-complete. Showing an OpenAI password-help link as if it changes the Folio password would be incorrect.

Add bounded request bodies and distributed attempt limits for credential endpoints. An in-memory counter alone does not survive Worker instance changes. Return safe errors and do not reveal hashes, session keys, invitation tokens or whether an arbitrary outsider has an account.

### Native identity alternative

If the owner chooses to keep platform login, the same D1 member/profile schema can key authentication to Sites' stable per-Site subject. This avoids a new password system, but the UI must state that login/password security belongs to ChatGPT. It is an explicit alternative, not a silent substitute for the currently requested Folio credentials.

## One shared workspace

Use a server-defined constant workspace identity. Account ID controls attribution and permissions, not a per-user file partition. All active members query the same folders, items, icon library and appearance settings. Avoid a future-looking multitenant framework or one database/bucket per account; the requested model is one collection shared by a small team.

### Suggested data ownership

| Record | Authoritative owner | Notes |
|---|---|---|
| Credential users and sessions | D1/auth package schema | Keep account IDs stable and session secrets out of responses. |
| Membership | D1 | Role, active/pending/disabled state, timestamps; cannot be client-assigned. |
| Profile | D1 | Account display name and normalized email; account changes require appropriate verification. |
| Workspace settings | D1 | Validated design-system color tokens and revision, shared by all members. |
| Shared folders/items | D1 | Stable IDs, kind, parent/path, revision, timestamps and actor attribution. |
| Original images/HTML/assets | R2 | Immutable content-addressed bytes; D1 supplies authorized references. |
| Saved icon sources/results | R2 plus D1 | Preserve source and result hashes, filenames, recolor state and provenance. |
| Conversion working queue | Current device | Local computation is appropriate; finished/saved data becomes shared through the explicit shared workflow. |
| Selection, scroll, local queue and companion pairing | Current device | These are not global file records or shared provider credentials. |
| Existing curated R2 collection | Existing R2 objects/catalogue | Read as shared base data; no private-media reingestion or destructive rewrite needed. |

Store the existing native-pixel fidelity result with its source/result revision and environment context. A server save, recolor or another member's download must not fabricate a fresh “pixel match verified” result. Recolored or AI-recreated artwork retains its existing honest provenance rules.

### Write consistency

Add a shared-storage service behind existing library/icon operations instead of scattering fetches through components. Preserve current bounded media decoding, source IDs, collision handling, folder semantics and stale-result checks. The cache may remain IndexedDB, but successful shared writes must await a server acknowledgement. Clearly distinguish pending upload, server-saved and failed states.

Upload immutable, checksummed R2 blobs first, then atomically commit their references in D1. Never make a partially uploaded asset visible. Unreferenced uploads can be cleaned up later using bounded, verified garbage collection; do not delete existing objects as part of this release. D1 prepared-statement batches execute sequentially and roll back if a statement fails; validate actual affected rows and constraints rather than assuming an optimistic update succeeded. [Cloudflare D1]

Require a record revision for updates; concurrent stale writes return a conflict instead of silently replacing another member's recolor, folder move or profile change. A brief poll/refresh on visibility change is sufficient initially; realtime infrastructure is not required to establish shared truth. If read replication is enabled later, use D1's documented consistency/session facilities.

The existing R2 `collection.json` administrative commit is a single-writer catalogue selection, not a safe general multi-user editing API. R2 supports conditional writes using `onlyIf`/ETag checks, which can protect an individual document against lost updates, but a growing set of accounts, sessions, invitations and file relationships belongs in D1. Do not repurpose the ingestion token as the editing protocol. [Cloudflare R2]

## API and UI boundaries

Resolve active app session and workspace membership before returning any shared catalogue, archive, image, original blob, icon SVG or export. Checking only the page route or hiding controls is insufficient. Protect legacy `/api/collection/*` reads as well as the new shared routes; keep administrative ingestion separately authorized.

Suggested endpoints are account/session, registration/login/logout/password change, current profile, owner-managed members, and shared folders/items/blobs/settings. Names are implementation choices; the critical rule is an authenticated actor, server-derived workspace ID and server authorization on every operation. An account cannot submit `role: owner` or another actor's ID to update their profile. Last-owner removal, self-escalation and disabled-member access must fail on the server.

An implementable small contract is:

| Operation | Suggested route | Required authority |
|---|---|---|
| Read current account/setup state | `GET /api/account` | Bounded public setup status; no member data without active app session. |
| Initialize first owner | `POST /api/folio-auth/bootstrap` | Trusted dispatch subject equals configured `FOLIO_OWNER_SITE_USER_ID`, owner not already initialized. |
| Login/logout/password change | `/api/folio-auth/*` | Auth package contract; recent authenticated session/current password where needed. |
| Create/revoke invitation | `/api/workspace/invitations` | Active owner; return the raw token once, persist only its hash. |
| Accept invitation and register | `POST /api/folio-auth/register` | Valid unused invitation, expected normalized recipient, atomic membership claim. |
| Read/update own profile | `/api/profile` | Active account; actor ID comes from the session. |
| List/disable members | `/api/workspace/members` | Active owner; protect the last owner. |
| Shared manifests/settings | `/api/workspace/items`, `/folders`, `/settings` | Active workspace member; owner restriction for design tokens if selected as product policy. |
| Stage/fetch immutable blobs | `/api/workspace/blobs/:hash` | Active workspace member; enforce type/size/checksum and referenced-object access. |

Add auth-library tables plus `folio_members`, `folio_invites`, a singleton `folio_workspace`, `folio_items`, `folio_folders` and `folio_objects`. A singleton workspace record can hold the shared settings revision and owner-initialization state. Store object references in normalized columns where constraints matter; do not depend solely on unvalidated arbitrary JSON. Membership and owner creation must not be derived from a count of users checked outside a transaction. A bearer invitation proves possession of an invitation; without a configured verification flow, do not label an arbitrary app-email field as independently verified.

Mount the real Settings route/page independently of its Profile tab. Login state belongs at the app boundary; it must not be fetched only when Settings opens. Show no private collection while an app session is unresolved or signed out. Account logout must revoke the server session and remove in-memory shared data/object URLs; ensure back-navigation does not redisplay cached shared content without revalidation. Treat existing personal IndexedDB imports carefully: do not erase them just to implement logout.

The Settings page can use the existing full-height sidebar pattern with Profile, AI, Appearance and, for the owner, Accounts. Reuse the new custom dropdown component wherever a choice list is needed. Theme settings validate a fixed set of colors, not arbitrary CSS. Account changes and shared theme writes should show success only after server persistence succeeds.

## Existing local data and safe migration

The requirement that all members see the same files needs shared persistence in addition to account work. Simply adding registration while leaving all imports and saved icons in browser-only stores must be reported as incomplete.

Do not silently upload all of the current browser's private imports. Provide a concrete review and explicit “Share this browser's files with the workspace” action showing the record/byte inventory and destination. The user's new collaboration request supports building this migration, while actual transfer of previously device-only files should happen through this deliberate in-app action. Do not inspect media for assessment, print filenames into logs, or add media to Git.

Stage migration with stable local-to-shared identity mapping and content-hash deduplication. Resolve collisions deterministically. Check all source blobs exist before committing a record. Preserve original folders, filenames, SVG artwork, recolor state, source links and fidelity provenance. A durable migration marker is written only after the server acknowledges complete records. Keep the original IndexedDB data as a recoverable local copy until the user explicitly removes it. Retrying an interrupted migration must not create duplicates.

The existing server collection can be attached as the shared base without downloading or reuploading its media. Add a mutable shared overlay for new imports and saved icons. Hide/delete/move behavior must become workspace behavior where the user expects everyone to see the same organization; a browser's old `hiddenCloudRoots` preference cannot silently define the team's authoritative library.

## Delivery checkpoints and proof

1. Commit the architecture/route/data contract, with no Site audience change.
2. Commit additive D1/auth schema, migration packaging and real server auth integration after the Worker compatibility check. Verify migration state independently of build success.
3. Commit login/registration/profile/password/logout integration and owner/pending membership handling. Test with synthetic accounts in local isolated storage, not fabricated production users.
4. Commit shared metadata/blob service and adapters for HTML, images, icons and appearance. Preserve the existing cloud catalogue and browser data.
5. Commit explicit migration/retry UI and concurrent-update handling.
6. Commit verification evidence, documentation and release notes that clearly distinguish implemented functionality, locally tested behavior and actual hosted/account checks.

Meaningful tests must demonstrate:

- Anonymous, expired, pending and disabled sessions receive no private metadata or bytes; rejected mutations produce no side effects.
- Registration/login/logout/password changes use real server records; a revoked session stops working and arbitrary identity headers are not accepted outside their established dispatch boundary.
- One-time owner bootstrap and invitation consumption survive concurrent attempts. A member cannot promote themselves or remove the last owner.
- Two separate browser storage contexts and two synthetic member identities see the same item IDs, original bytes, saved/recolored SVG and workspace theme. Two tabs sharing one IndexedDB are insufficient evidence.
- A stale revision conflicts predictably; an interrupted upload/migration can retry without duplicate data or broken references.
- Reload and logout/back navigation do not reveal protected server data through stale in-memory UI. Legacy local imports remain intact.
- Native PNG/WebP conversion and local companion behavior remain intact; application login does not send files to an AI provider automatically.
- Production `Set-Cookie`, session revalidation and migration application work through the real hosting boundary. A service bypass token is not proof of a logged-in user journey.

No teammate address has been provided, so a real second-person hosted sign-in and invitation cannot be truthfully claimed. Build and test the feature with isolated local fixtures, preserve the private Site, and state this specific runtime limit in the release. It need not block unrelated layout, dropdown, Settings or appearance improvements.

## Sources and evidence limits

Repository evidence: `worker/account.mjs`, `worker/index.js`, `worker/cloud.mjs`, `src/db.ts`, `src/cloud.ts`, `src/icon-collection.ts`, `src/components/ProfileSettings.tsx`, `.openai/hosting.json`, `scripts/build-worker.mjs`, `package.json` and revision-9 account review.

Platform sources read: installed Sites 1.1.2 `references/identity-and-secrets.md`, `references/storage.md`, Worker-ESM starter README, and the current `sites_update_site_access` tool contract. Workflow sources: GAA stage contract, architect and security-verifier handler profiles, database specialist profile and shared specialist contract. Cloud handler-resource reads failed, so the matching installed workflow 3.1.0 files were read as the fallback. No skill exception was used to claim unavailable hosting capabilities.

Primary web sources, retrieved 2026-10-31:

- [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/): prepared statements, batch rollback and session consistency.
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): conditional object writes and ETag checks.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): server sessions and cookie protection.
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): slow salted password hashing.
- [Better Auth official 1.5 release source](https://github.com/better-auth/better-auth/blob/main/docs/content/blogs/1-5.mdx): native D1 binding support and batch-based atomicity rather than interactive transactions.
- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password): credential registration/login/logout and recovery hooks.
- [Better Auth cookies](https://better-auth.com/docs/concepts/cookies): opaque signed session cookie and production attributes.
- [Better Auth relational databases](https://better-auth.com/docs/adapters/other-relational-databases): D1 dialect reference. The package version and actual Worker bundle compatibility remain implementation verification, not an assessment guarantee.
- [Cloudflare Node crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/): current runtime support and compatibility requirements; native Argon2 exception.
- [Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/): native cryptographic operations including PBKDF2 derivation.

No app source, credentials, account records, Site access, media, Git history or deployment was mutated by this assessment. Only this advisory artifact was written.
