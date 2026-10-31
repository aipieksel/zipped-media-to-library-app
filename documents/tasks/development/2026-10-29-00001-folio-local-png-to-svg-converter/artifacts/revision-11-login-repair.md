# Revision 11 — login/startup repair

## Confirmed failure

The user reported `logoin doesnt work` after version13. Read-only production evidence showed a successful owner bootstrap201 and later login200 responses. In the actual owner browser, `/api/account` reported authenticated:true and an account, with setupRequired:false. The main page showed “The shared workspace connection was interrupted. Retry when the connection is available.” No shared document request reached the server.

The fault was in the next step after authentication: `SharedWorkspaceClient` stored native fetch and invoked it as `this.fetcher(...)`, supplying the client object as the receiver. The browser rejects that invocation before HTTP. The shared client's error wrapper converted it into the misleading connection message. No password or cookie value was read, changed or recorded.

## Narrow correction and review

The production change is one invocation: `this.fetcher.call(globalThis, path, options)`. All request options, same-origin credentials, redirect policy, timeout/cancellation, size limits, authorization, schema and storage behavior remain unchanged. This covers both default native fetch and explicitly injected native fetch.

Two independent reviewers reproduced the original receiver failure. `/root/r10_ui_audit` inspected the final one-line patch and regression and approved it without findings. Earlier unit transports and the development application's fetch interceptor were arrow functions; those ignore receivers and masked the production defect. The new regression uses a normal receiver-sensitive function.

## Focused verification

- Before the product change: `node --import tsx --test --test-name-pattern='default and injected browser fetch' tests/shared-client.test.ts` exited1 with the exact production shared-network error.
- After the change: `node --import tsx --test tests/shared-client.test.ts tests/account-client.test.ts` exited0: **20 passed,0 failed,0 skipped**. It covers default/injected native-style receivers, all three concurrent startup documents, request controls and existing shared metadata/blob/CAS/migration/export/account regressions.
- The final production build, deployment and actual browser startup are the remaining release gates. This record does not claim success before those checks finish.

The owner has now performed real production account creation and login themselves. That is separate from the still-unperformed R29 real OpenAI/Codex image request.

## Release-gate finding: stale packaged frontend

The first repair publication, Site version14, completed at2026-10-31T20:48:09.434611+00:00 from native source871092a584e7210b0603bd5368967e2fd7b66bbc. Actual browser verification still loaded the previous `index-Dbky8qzf.js`. The generated frontend manifest instead held `index-BxDdEF5W.js`. Direct authenticated navigation to the shared library endpoint succeeded, confirming the session and server were functional.

The deployment archive and local Worker were byte-identical to the previous release: SHA256 `c9086e6eaaab8e87d28d51759fce85809b566e9b0ae1b7e32fcdeb29cf953a37`. The new asset key, JavaScript body and index.html body were absent. A read-only esbuild invocation with `write:false` returned the current Worker. The process/filesystem cause of the stale default-write output is not established; successful compilation alone did not establish output freshness.

The bounded release-gate repair captures one frontend manifest, supplies that exact JSON to the compiler, requests output in memory, verifies every captured asset key/body, explicitly writes those returned Worker bytes and checks byte-for-byte readback. Worker runtime conditions, hosting manifest, privacy controls and deployment audience are unchanged. Packaging must additionally match the verified Worker digest before publication.

`node --import tsx --test tests/worker-build.test.ts` passed1/1 with zero skips. It builds two successive synthetic frontends through the real build script, executes both resulting Workers, checks exact HTML and JavaScript responses, verifies the old frontend is absent after the second build, excludes server output from public assets and preserves the hosting manifest. No private data or credentials are used.

Independent build diagnosis: `/root/r10_accounts_architecture` confirmed the stale manifest/output mismatch and recommended explicit input/output handling. Final diff review and the corrected publication/native-browser result follow below when complete.

The independent diff review identified one additional build precondition: a second packaging-only invocation could otherwise accept an empty asset map. The script now rejects a missing fresh `dist/index.html` before deleting output. The regression also checks that rejection and preservation of the last valid Worker.

## Verified release and real-browser result

The reviewer `/root/r10_ui_audit` confirmed that finding closed and approved the final build repair without remaining findings. The focused repeat-build test passed again1/1 after the negative case was added. The privacy-gated checkpoint was pushed as `8ef61948cc553a34ef22822d18ec2957ebc95923` after the transport checkpoint `be8bb9af4e91c1199f2ec24442af1a9da3d7e383`.

The official Site build passed TypeScript, Vite and Worker packaging from native source `d1e4f98d57f2de2b2f784eb88613668305ede782`. All13 frontend asset keys and exact bodies are present in the Worker. The archive contains exactly those Worker bytes, SHA256 `f7a33b924c736977466459dcf6405083530ca6186ac0efd216ea0c4ed83a6bea`, and133 selected runtime/build/companion/database/CI files match the GitHub checkpoint. The archive SHA256 is `30aa636cccf926f27528b9bb59b1798cfedae28e284d0306724b9edef4e01535`.

The same owner-private Site published **version15**, deployment `appgdep_6ae655af04a0819180ab9644817e9f1a`, successfully at2026-10-31T20:55:29.288481+00:00, environment revision3. Access remains custom/owner-only with zero external visitors. No authentication settings, password, session policy, database schema or media were changed by this repair.

The actual owner Chrome browser reloaded the published app with native fetch, loaded `/assets/index-BxDdEF5W.js`, and displayed the Library sidebar and workspace switcher with no alert. Settings opened its real Profile page and Appearance page; both had no alert. The production logs independently show status200 for the session endpoint and all three shared startup documents (library, icons and appearance) on the new Worker version. Successful legacy collection reads were also observed. The sanitized provider/build/browser receipt is `revision-11-release.json`; no account identifier, cookie, password, private filename or private screenshot is committed.

S6 is resolved. R14/R34/R40 close again from the actual production evidence. The owner has already completed real registration and login, so the old first-activation handoff is no longer current. R29 remains not_run because real image-to-SVG inference through the user's local authenticated OpenAI/Codex companion was not part of this login correction; aggregate R12 stays open for that precise inherited requirement. Original revision11 admission hashes remain unchanged.
