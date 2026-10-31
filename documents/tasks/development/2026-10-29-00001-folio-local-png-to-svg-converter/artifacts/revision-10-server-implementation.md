# Revision 10 — server implementation evidence

Owner: `/root/r10_accounts_architecture`. Scope: admitted P16/P17. Status: server implementation, generated migration, focused SQLite suites and native workerd integration verified; ready for coordinator checkpoint/integration. No production credentials, memberships, invitations, media transfer, Site audience or deployment changes were performed by this delegate.

## Written boundary

- `worker/auth-common.mjs`: bounded streaming request readers, JSON validation, exact same-origin mutations, private/no-store JSON errors, persistent atomic D1 rate windows.
- `worker/auth-password.mjs`: Better Auth's custom password hook using native `node:crypto` scrypt, OWASP profile `N=32768,r=8,p=3`, random 16-byte salt, 32-byte output, strict versioned representation and constant-time comparison. No fast/weak fallback.
- `worker/auth.mjs`: Better Auth 1.7.14/D1 credentials and opaque sessions; trusted configured Site-owner bootstrap; invited recipient registration; real profile, login/logout/password change; membership checks; owner member management; owner step-up member recovery and trusted-Site-owner recovery. No generic unauthenticated Better Auth signup/password endpoint is forwarded.
- `worker/workspace.mjs`: three bounded, revisioned shared documents; D1 CAS; staged immutable SHA-256 R2 blobs/chunks; verified dependencies before publication; member-gated referenced-blob downloads; no deletion or modification of the existing curated collection.
- `db/schema.ts` / `db/drizzle.config.ts`: additive Better Auth and Folio schema, one-owner unique constraint, token and rate records, document/blob metadata. Generated schema-only SQL, journal and snapshot are in project-root `drizzle/`, matching the Sites packager contract.
- `tests/folio-auth-helpers.mjs`: real SQLite exposed through D1 prepared/batch operations, isolated synthetic fixtures and independent cookie clients.
- `tests/folio-auth.test.ts`, `tests/shared-server.test.ts`, `tests/folio-auth-worker.test.ts`, `tests/folio-dispatch.test.ts`: credential, authorization, recovery, revocation, concurrency, shared bytes/CAS, failure retry, legacy resource guard and native-runtime journeys.

The exact client contract is in `revision-10-http-contract.md`. The coordinator owns app/client integration, legacy collection protection/cache changes, package/build/hosting configuration, Git checkpoints and native publication.

## Compatibility and migration evidence

The exact installed Better Auth version is 1.7.14. A browser-platform esbuild bundle of the auth/workspace modules with `node:*` external succeeds without warnings, approximately 2.05 MiB unminified. This does not prove production compatibility flags by itself.

A narrow registration/login probe passed with Better Auth's native D1 dialect against real Node 24 SQLite: signup 200, login 200, HttpOnly/Secure/SameSite=Lax session cookie and a seven-day lifetime. The selected scrypt hook was used, with combined local signup/login time approximately 499 ms. Standalone hash verification accepts the correct password and rejects wrong/malformed inputs. Only synthetic credentials were used and no credential values/hashes/cookie secrets were emitted as evidence.

Actual `workerd` + native D1 + R2/cookie execution now passes using Miniflare 4.20260730.0, compatibility date `2026-07-30` and explicit `nodejs_compat`. The test executes the real integrated `worker/dispatch.mjs`, applies the generated SQL to D1, creates two synthetic accounts through owner bootstrap/invitation, verifies the protected account alias, stages and publishes actual R2 bytes, reads the same document from the second account, then logs out and verifies shared and legacy read denial.

Miniflare's default static module scanner initially rejected the SDK's unused optional dynamic-import adapters. Its documented explicit `modules` array runs the same bundle successfully in workerd without changing application code or importing an unused adapter. The default filesystem sandbox also prohibits the necessary loopback listener (`listen EPERM 127.0.0.1`); the successful native run used the approved execution escalation for this isolated local test. A full test command including this native test therefore requires permitted loopback access. No external service/account/storage was used.

Drizzle ORM 0.45.4 / Drizzle Kit 0.31.11 generated nine tables plus indexes/constraints through `node node_modules/drizzle-kit/bin.cjs generate --config db/drizzle.config.ts`. Inspected the resulting SQL: schema only, no seed accounts or secrets. Both the SQLite suites and native workerd applied this exact generated migration successfully. Root `drizzle/` is copied by Sites' `scripts/package-site.mjs` into `dist/.openai/drizzle`; no runtime DDL was added.

### Decisive verification

| Command | Result |
|---|---|
| `node --import tsx tests/folio-auth.test.ts` | 7/7 behavior tests passed, including credential replacement races, recovery invalidation and interrupted-registration resume. |
| `node --import tsx tests/shared-server.test.ts` | 2/2 passed: two independent clients, shared bytes and metadata, conflicts, checksums, staged dependencies and failed-upload retry. |
| `node --import tsx tests/folio-dispatch.test.ts` | 2/2 passed: legacy metadata/file/image GET/HEAD/conditional access, zero denied Bucket reads, private/no-store including 304, revoked cookies, and separate ingestion authority. |
| `node --import tsx --test tests/folio-auth-worker.test.ts` | 1/1 passed in actual workerd/D1/R2 with integrated dispatcher, approximately 1.93 seconds for the test. |

These are 12 focused behavior tests with no skips. The combined auth/shared `--test` command also passed; the direct commands above expose each individual behavior rather than only file-level summaries.

## Independent early review and repairs

A separate `/root/r10_accounts_architecture/server_boundary_review` agent examined the server without source mutation.

1. **Old-password login overlapping recovery could create a post-revocation session.** The wrapper now snapshots the credential before slow verification, rechecks it after SDK session insertion and removes only the newly issued session when credentials changed. The reviewer independently reproduced the interleaving against real SQLite and verified 401, no session cookie and zero remaining sessions after the repair. A deterministic session-INSERT pause regression is included in the committed test source.
2. **A normal password change left previously issued recovery tokens usable.** Password change now atomically invalidates pending reset tokens along with session revocation, guarded by the successful previous-hash CAS. The reviewer independently verified changed password 200, old token 400 and newly authorized token 200. A regression also exercises this sequence.
3. **Interrupted registration could not be reinvited.** Invitation creation now rejects existing memberships, while allowing an incomplete credential account to receive a replacement invitation. Resume requires the stored password and an authorized new invitation; a user-only SDK partial failure can receive a guarded initial credential inside an already authorized registration. The reviewer independently verified replacement invitation 201, wrong password 400, correct resume 201 with the same user ID, and successful user-only partial recovery. Corresponding regressions are included.

The early reviewer concluded that no unresolved material finding remained in this bounded source review. Its focused reproductions used real SQLite with the installed SDK and minimum relevant tables; they do not substitute for the generated migration and full workerd/integration tests below.

Invite and reset expiry is rechecked at the database commit after slow hashing. Password changes use an explicit D1 batch/credential-hash CAS rather than assuming Better Auth can create an interactive D1 transaction. Cookie caching is disabled; active membership is checked server-side on private requests. Every mutation checks Origin. No request handler creates or alters database tables.

## Source identities

| File | SHA-256 |
|---|---|
| `worker/auth.mjs` | `e424812654fd58ba1b7510e12748907c25cfdaeb1dbff5b6859bcc1e563393ea` |
| `worker/auth-common.mjs` | `3e4c6d77449734061b0a738f9c3d1a72ea26ff048321b2523b972fde8493921a` |
| `worker/auth-password.mjs` | `a499ec14dd6a61a0ddff79406d92fa1169bd6e1812d8176c235210b696143946` |
| `worker/workspace.mjs` | `9c9aff99bbdd51123c5c35dfd3b10681912186d85fc8dd4603b115ac6287689e` |
| `drizzle/0000_ambiguous_kinsey_walden.sql` | `6dbf574c11a5eb28ab8d9a1aae65ec89030c2c85f1865b307da1d9764dc1b8da` |
| `drizzle/meta/_journal.json` | `5cd7b5979f949766f467a0c9cd0507a293251a34e4f27f491af5d6065f383c0a` |

The four server implementation hashes match the independent review's final snapshot.

## Remaining integration and production evidence

- Commit the generated SQL, snapshot and journal with the coordinator's checkpoint. Applied migrations become immutable; append future schema changes.
- Root's legacy dispatcher/cache integration is now exercised by the two focused tests and native runtime test. Actual browser logout must also clear rendered shared resources and object URLs; server tests cannot prove that UI behavior.
- Root owns schema-validated client adapters, explicit local-file migration, route/auth UI and real shared persistence acknowledgement. A generic JSON manifest API does not establish the full library behavior alone.
- Production owner password remains a user-entered setup action. An actual teammate requires a named Site-access decision; no invitation is invented or sent.
- Sites' Worker-ESM starter/packager does not document a production compatibility flag/date manifest field. The Vinext starter explicitly configures `nodejs_compat` for its local runtime. Do not invent manifest fields or infer deployed compatibility solely from that local configuration; verify the existing Site's native build/deployment and real cookie round trip. Production migration application remains separate evidence from the local D1 pass.

No deployment, real production registration, production-cookie round trip or completed second-person hosted access claim is made by this server receipt.
