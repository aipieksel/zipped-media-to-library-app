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
