# Revision 9 — development-only AI UI fixture

Executor: `/root/ai_package_audit`. Date: 2026-10-31 UTC. This bounded execution follows the coordinator's admitted revision-9 implementation and explicit follow-up assignment. It is not an independent review of the helper or fixture authored by this agent. Root retains browser execution, full build, Git, release and real-account verification.

## Maintained changes

- `tests/ai-ui-fixture.ts` implements a development-guarded fetch adapter, installed only into the real application's same-origin QA iframe. It intercepts exactly `http://127.0.0.1:8798/v1/*`. Other traffic retains the original fetch behavior. Unknown routes at the intercepted endpoint return fixture errors; none falls through to a local companion or provider.
- `tests/icon-collection-browser-check.ts` adds “Enable AI UI fixture” and a response selector to the existing actual-app harness. Existing synthetic import and storage controls retain their behavior. The iframe and parent share no new production hook.
- `scripts/prepare-icon-library-check.mjs` documents the optional fixture in its generated-page preparation receipt. The generated `.qa/icon-library-check.html` already loads the maintained test entry, so controls come from that entry without a production page change.

All status/model/summary/fixture observations use **QA fixture · no provider**. The protocol-safe model ID is `qa-fixture-no-provider`. Authentication is `not-checked`; the adapter does not claim a real ChatGPT sign-in. No CLI, provider or account is invoked by an intercepted request. The publicly documented test pairing code consists of 43 `A` characters and is not a credential.

The adapter uses the actual shared request/response schemas. It checks UUID request IDs and uniqueness, provider/model/reasoning selection, instructions schema/length, PNG container/signature and agreement of attachment dimensions with request metadata. Evidence retains metadata only, excluding attachment bytes, source filename, instruction text and submitted SVG text. The original app remains responsible for preparing the attachment, parsing/sanitizing output, native pixel checks, candidate state and saving to its real development-origin IndexedDB.

## Interaction sequence

1. Open the existing `/.qa/icon-library-check.html` on the dedicated development origin and select **Enable AI UI fixture**.
2. In the actual app's AI Settings, connect on port `8798` using the displayed 43-character `A` code. The available model is **QA fixture · no provider** with medium reasoning. This tests Settings plumbing only.
3. Select a procedural imported image/icon. The **Success** response returns deterministic safe rectangles/circles with the requested native dimensions and a fixture-labeled summary. Use the real Generate, preview, native comparison and Save controls.
4. Set **Held until cancelled** before the next request. The promise remains pending until the real client's AbortSignal or cancellation endpoint is used. The adapter records both held-job cancellation and any DELETE acknowledgement; cancelled work does not return a candidate.
5. Set **Unsafe SVG** before the next request. The schema-valid response includes a script element containing only a fixture comment. The production SVG validator must reject it before preview or save; it is not an executable payload.
6. Reloading the iframe disables the fixture. Enable again before another fixture connection. Disposal cancels held requests and keeps the old iframe's endpoint blocked until reload, preventing late cancellation callbacks from falling through to a real companion.

Changing the selector affects requests that start afterward; it does not release an already held job. Use the real app's Cancel control. The wrapper does not modify the app's stored selection or candidate through a test hook.

## Source-normalization regression follow-up

The same bounded assignment produced `src/ai/source.ts` and `tests/ai-source-browser-check.ts`. Root has now adopted `normalizeValidatedAiSource` after `prepareAiImage` in `AiSvgPanel`. The helper retags exact original PNG/WebP/JPEG bytes from their signature, after full preparation validation, while keeping the normalized PNG provider attachment separate. Strict saved-source format checks remain intact.

The native browser regression exports `runAiSourceChecks()`. It creates procedural WebP bytes using canvas, tests both an incorrect PNG MIME and an empty MIME, prepares the PNG attachment, normalizes the original source, performs a native comparison, proves the strict store still rejects a wrongly declared source, then saves/reopens an isolated QA database and checks exact original bytes and source metadata. Unsupported native WebP encoding fails explicitly; no fake browser pass or provider response is involved.

## Checks and limitations

Focused TypeScript diagnostics passed for `src/ai/source.ts`, `tests/ai-source-browser-check.ts`, `tests/ai-ui-fixture.ts` and the maintained interactive harness, with `noEmit`. Diagnostics were filtered to these owned files plus global errors; this is not a whole-project build. One intermediate type error in the fixture's union narrowing was corrected before the successful check. `node --check scripts/prepare-icon-library-check.mjs` also passed.

No browser, account, package, Git or full build action was performed by this agent. Success/cancel/unsafe UI journeys, native source-byte regression, keyboard focus/status behavior and real-account inference are not passed by this artifact. Root will execute the native journeys and record their evidence. Fixture output must never be used as proof of authentication, live-provider inference quality or pixel-perfect reconstruction.
