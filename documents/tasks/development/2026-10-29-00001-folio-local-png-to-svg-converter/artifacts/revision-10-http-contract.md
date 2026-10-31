# Revision 10 — server/client HTTP contract

Owner: `/root/r10_accounts_architecture`. This contract is for the admitted P16/P17 implementation. Routes return JSON and `Cache-Control: private, no-store`; errors use `{error: string, code: string}`. All unsafe requests require an exact same-origin `Origin` header and `application/json`, except raw blob PUT. Cookies are opaque, HttpOnly and server-owned; clients use same-origin credentials and never store a returned credential token.

## Authentication

`Account = {id: string, email: string, name: string, role: 'owner' | 'member'}`.

`GET /api/folio-auth/session` returns `{authenticated: boolean, account: Account | null, setupRequired: boolean, canBootstrap: boolean, canRecoverOwner: boolean, siteSignInPath: '/signin-with-chatgpt?return_to=%2F', siteSignOutPath: '/signout-with-chatgpt?return_to=%2F'}`. A missing app session is HTTP 200 here; configuration/storage failure is 503. `canBootstrap` and `canRecoverOwner` require the trusted configured Sites owner. They do not expose that subject in responses.

| Route | Method/body | Success |
|---|---|---|
| `/api/folio-auth/bootstrap` | POST `{email,name,password}` | 201 `{account}` plus session cookie; only configured trusted Sites owner, once. |
| `/api/folio-auth/login` | POST `{email,password}` | 200 `{account}` plus session cookie. |
| `/api/folio-auth/register` | POST `{email,name,password,token}` | 201 `{account}` plus cookie; recipient-bound invitation required. |
| `/api/folio-auth/logout` | POST `{}` | 200 `{ok:true}` and expired cookie; idempotent. |
| `/api/folio-auth/profile` | PATCH `{name}` | 200 `{account}`; email is not editable without a verified change flow. |
| `/api/folio-auth/password` | POST `{currentPassword,newPassword}` | 200 `{ok:true}` plus a replacement current-browser session cookie; revokes all old sessions and pending recovery links. |
| `/api/folio-auth/invitations` | GET | 200 `{invitations: Invitation[]}`; owner only; no raw tokens. |
| `/api/folio-auth/invitations` | POST `{email}` | 201 `{token,email,expiresAt}`; owner only; copy-link capability returned once, no email sent. |
| `/api/folio-auth/invitations/:id` | DELETE | 200 `{ok:true}`; owner only. |
| `/api/folio-auth/members` | GET | 200 `{members: Member[]}`; owner only. |
| `/api/folio-auth/members/:id` | PATCH `{status:'active'|'disabled'}` | 200 `{ok:true}`; owner only; cannot disable owner. |
| `/api/folio-auth/members/:id/recovery` | POST `{currentPassword}` | 201 `{token,email,expiresAt}`; authenticated owner with password step-up; member accounts only. |
| `/api/folio-auth/owner-recovery` | POST `{}` | 201 `{token,email,expiresAt}`; configured trusted Sites owner; no Folio session required. |
| `/api/folio-auth/recovery` | POST `{email,token,newPassword}` | 200 `{ok:true}`; consumes reset capability once and revokes all account sessions. Client then shows Login. |

`Invitation = {id: string,email: string,expiresAt: number,createdAt: number}`. `Member = Account & {status:'active'|'disabled',createdAt:number}`. Timestamps are Unix milliseconds. Owner recovery is user initiated, never executed automatically by loading the page. Passwords are 12–128 characters; display names are 1–80 characters; email addresses are normalized to lowercase and at most 254 characters.

Copy invitation links as `/#register?token=<encoded>&email=<encoded>` and recovery links as `/#recover?token=<encoded>&email=<encoded>`. Fragments keep the capability out of normal server access logs. Read into transient form state and remove the fragment token from browser history after consumption; do not persist it in browser storage.

## Shared documents

`DocumentName = 'library' | 'icons' | 'appearance'`.

`GET /api/workspace/documents/:name` returns `{name,revision,data,blobs,updatedAt}`. An absent document has `revision:0,data:null,blobs:[],updatedAt:null`.

`PUT /api/workspace/documents/:name` body is `{expectedRevision:number,data:object|null,blobs:string[]}`. Success returns the committed complete document. `expectedRevision` must match server truth; initial creation expects 0. A stale revision returns HTTP 409 `{error,code:'conflict',revision:number}`. The client must explicitly reconcile; it must not silently overwrite or show shared success after a cache-only save.

The complete JSON request is capped at 1 MiB; `blobs` has at most 10,000 unique lowercase SHA-256 hex strings and must reference already uploaded blobs. `data` is bounded JSON metadata, never inline original bytes/SVG strings. Dataset adapters validate their own versioned schema. Existing curated R2 catalogue/media is excluded; reference it by its existing cloud identities.

## Immutable shared blobs

`PUT /api/workspace/blobs/:sha256` uploads raw bytes with `Content-Type: application/octet-stream`. Maximum single blob/chunk is 8 MiB. The Worker hashes and checks bytes, writes a separate R2 prefix, then registers immutable metadata. Success is `{hash,size}`. Repeating identical content is safe. No ingestion secret or arbitrary R2 path is exposed.

`GET` and `HEAD /api/workspace/blobs/:sha256` require active membership and a reference from a published shared document. Response is `application/octet-stream`, private/no-store, nosniff; the client restores the validated original MIME type from its document metadata. Unknown or staged/unreferenced blobs return 404. Larger source files are split into ordered chunks with lengths and MIME/type metadata in the dataset. Client verifies/reassembles chunks as needed.

Every shared route requires active app membership. All members read the same three documents and referenced blobs. `createdBy`/`updatedBy` are audit metadata, not user partition keys. Private resource cache headers and root app logout cleanup are coordinator-owned integration requirements.

## Worker exports and runtime configuration

`worker/auth.mjs` exports `handleFolioAuth(request, env): Promise<Response|null>` and `requireMembership(request, env): Promise<Account|Response>`; a Response is a denied/unavailable request. The root can gate legacy collection reads with the latter.

`worker/workspace.mjs` exports `handleWorkspace(request, env): Promise<Response|null>`, with its own membership checks.

Bindings: `env.DB` D1, existing `env.BUCKET` R2. Secrets/configuration: `FOLIO_AUTH_SECRET` (random >=32 characters), `FOLIO_OWNER_SITE_USER_ID` (trusted actual owner subject, never committed), optional `FOLIO_APP_ORIGIN` (the existing exact Site origin). Root owns those settings, manifest/build integration and migrations publication. No production password or teammate is supplied by code.

The actual Better Auth compatibility spike and server implementation/tests are separate evidence; this contract is not a claim they already pass.

## Client metadata extension — revision 10

The generic server document/blob contract is unchanged. The completed Library and Icons adapters may store either the inline versioned dataset or a compact index `{schema:1,kind,manifest:BlobReference}` in `data`. The index points to immutable `application/json` dataset metadata uploaded through the same authenticated chunk API. The adapter uses this form above 384 KiB of serialized metadata and bounds the expanded metadata at 64 MiB, with at most 100,000 records in any dataset store. The existing 20,000-entry Library admission bound applies per import. Appearance remains its validated six-field palette directly.

For a manifest index, the server document's `blobs` contains the exact unique union of metadata-chunk and asset-chunk hashes. Client reads verify immutable bytes and dataset schema, then require that exact reference union before installing the dataset. A single revision CAS publishes the complete index and all its references. The root request still has the same 1 MiB body and 10,000-hash limits; each immutable chunk is still at most 8 MiB.

File BlobReferences may additionally use `{hash,size,offset,length}` for a bounded slice within a fully hash-verified chunk, allowing many small files to share one chunk. Both offset and length are required together, are bounded integers, and may not exceed the chunk's verified size; descriptor file size must equal the sum of selected slice lengths. References without slices remain supported. No new public route, R2 path, identity source or weaker authorization is introduced. Implementation/large-dataset and independent shared-client evidence are in the corresponding revision-10 shared reports.
