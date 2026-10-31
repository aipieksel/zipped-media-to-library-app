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
