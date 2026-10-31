# Revision 9 — GUT unit and integration verification

Date: 2026-10-31 UTC. Record: `2026-10-29-00001-folio-local-png-to-svg-converter`, plan/reviewed revision 9.

## Outcome and role disclosure

**PASS for the complete configured npm test run, with one existing optional fixture test skipped.** There were no failing or cancelled tests. The privacy hooks were enabled and completed successfully.

Verifier: `/root/ai_auth_research`, acting in the workflow's GUT `unit-verifier` role for this run. This same agent previously implemented the companion/vendor/shared AI modules and their focused tests. This artifact is therefore an execution receipt, **not an independent review of that agent's implementation**. Independent companion/security source review is recorded separately in `revision-9-companion-review.md`; root owns the other source/UI review and browser verification.

The GUT stage and unit-verifier instructions were read in full before execution. This stage made no application-source changes, installed no dependencies, ran no build, performed no Git mutation and did not deploy. Only this verification artifact, the captured test log and input hash manifest were written. The existing privacy hook performs its own read-only Git index/blob inspection.

## Environment and exact command

Working directory: `/workspace/scratch/6d5f921cc245/folio`.

- Linux x86_64.
- Node.js `v24.22.1`.
- npm `11.9.0`.
- Launched at `2026-10-31 16:19:55 UTC`; successful terminal completion was confirmed before the `16:20:16 UTC` result/hash inspection.
- The command used the permitted execution capability outside the default sandbox because the companion fixtures require loopback listening and disposable child-process output. Automatic review approved that specific local test operation. No real provider credentials, OpenAI sign-in or provider inference was used.

Exact top-level command, executed once:

```sh
npm test > documents/tasks/development/2026-10-29-00001-folio-local-png-to-svg-converter/artifacts/revision-9-npm-test-output.txt 2>&1
```

Exit code: **0**. No test hooks were disabled. The scripts expanded to:

```sh
# npm pretest
npm run check:privacy && node --test tests/repository-privacy.test.mjs

# npm check:privacy
node scripts/check-repository-privacy.mjs

# npm test
node --import tsx --test tests/*.test.ts
```

The runner emitted npm's existing `Unknown env config "http-proxy"` warning. It did not affect the test outcome; no environment configuration was changed during verification.

## Results

| Check | Registered tests | Passed | Failed | Skipped | Cancelled | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Repository index privacy scan | — | — | 0 violations | — | — | Passed for 255 source files |
| Privacy checker tests | 4 | 4 | 0 | 0 | 0 | Passed, 70.328 ms reported runner duration |
| Complete TypeScript unit/integration suite | 290 | 289 | 0 | 1 | 0 | Passed, 4014.666 ms reported runner duration |
| Combined test totals | **294** | **293** | **0** | **1** | **0** | **Exit 0** |

Both runners reported zero TODO tests and zero suites. The full main suite includes all 24 current AI companion/client/process/HTTP fixture tests, including C1–C4 regressions, along with account, SVG safety/recolor, PNG/WebP, archive, cloud-resource, image, grid and tree regressions.

### The single skip

`tests/archive.test.ts` declares:

> real Library wrapper reconciles 12 pages with its two unchanged source ZIPs

It uses `skip: !existsSync(realFixture)`, with the optional local fixture at `../../fixtures/nested-real-library-fixture.zip` relative to the test file. That fixture is absent in this workspace. The test was skipped by its existing condition; no test or fixture was changed to obtain a pass. This run does not verify that private real-archive case. Procedural archive regression tests ran and passed.

## Acceptance coverage and remaining boundaries

| Revision 9 check | Evidence from this run | Boundary / separate evidence still required |
| --- | --- | --- |
| **T20 — companion/package isolation and jobs** | All 24 AI tests passed: exact Host/Origin/token rules, strict request schemas, loopback client, held-body cancellation/deadline, single active request, process hard kill/output bounds, bounded answer file, positive ChatGPT status parsing, forced auth and built-in gates, correct config precedence, actual fixture PNG attachment/stdin, safe output and incomplete/tool-event rejection. | CLI fixtures establish adapter behavior. They do not establish the user's installation, account entitlement, real model access or successful image inference. The actual 0.166.0 config-only probe belongs to the independent review, not this npm run. |
| **T21 — SVG and image fidelity** | SVG validator, native viewport/geometry bounds, active/external/raster/XML rejection, source attachment and existing PNG/WebP conversion/comparison tests passed. | Node tests do not render the resulting SVG through a browser. Native raster comparisons, the Images-to-AI UI journey and model reconstruction quality require their separate browser/account evidence. |
| **T22 — curated saved artwork and color** | Safe recolor retains alpha, inherited paint, `none` and gradient opacity; saved defaults/shared folder projection and existing collision-safe SVG/ZIP tests passed. | Actual IndexedDB upgrade, transaction abort, save/reload/delete independence and downloaded preview equality are browser checks. This run does not claim those persistence journeys were exercised. |
| **T23 — shared UI and cancellation** | Existing tree/grid/component regressions and AI client request cancellation/status deadline/UUID compatibility passed. | Actual modal focus, keyboard interaction, responsive layouts, late UI candidate results, hosted-loopback permission and navigation journeys remain browser verification. |
| **T24 — account identity** | All nine account-route tests passed, covering trusted identity, missing/malformed identity, encoded names, private uncached responses, invalid authority sources, read-only methods and fixed safe auth paths. | No production session, real sign-in, password or provider-account setting was changed or tested. |
| **T25 — source and release** | Privacy scan and both configured test runners passed against the captured inputs. | No production build, commit/push/readback or deployment was performed by this verifier. Root's build/release evidence remains separate. |

Existing regression coverage for pixel rectangle merging, alpha/transparency, embedded original bytes, WebP structure/bounds/animation rejection, filename collisions, ZIP contents, curve/silhouette guards, metadata, resource authorization and library navigation remained passing. This is not a universal browser or color-profile fidelity claim.

## Input stability and hashes

A pre-run SHA-256 snapshot covered 140 source/test/config files. The post-run comparison found **139 unchanged inputs** and one concurrently edited browser-only QA helper: `tests/ai-ui-fixture.ts`.

The helper's only observed import is from `tests/icon-collection-browser-check.ts`; neither file matches the configured `tests/*.test.ts` runner, and the import search found no reference from the executed tests or application source. It is outside this npm test execution. No application source, executed test or dependency/config input changed during the run. The unaffected suite was not rerun merely for that independent browser-harness edit.

The stable 139-file snapshot is retained as `revision-9-unit-inputs.sha256`. It includes source, companion, vendor source, worker, tests/helpers, scripts and root package/lock/config/notices. Per-file SHA-256 values are recorded there; the changed browser-only helper is excluded from that stable manifest and recorded explicitly below.

| Artifact/input | SHA-256 |
| --- | --- |
| `revision-9-npm-test-output.txt` | `64ce8e18717ec6cc840b7926267f6b565527c21f029f7d59d7d0076fc2804681` |
| `revision-9-unit-inputs.sha256` | `6e018c822a2b7efa595d4852ce93c6c8eba96419da6c515640c72f072cf69fea` |
| Full 140-file pre-run manifest | `737d4bb1ebe328c5c9c572709059629fc913a1fa455c868473a2eb9bcdcbb451` |
| Full 140-file post-run manifest | `6936c282fbd9be7e569ff0185f410d075e9dae7fd8e598f006915ab7ffd1debe` |
| `package.json` | `426cf9395d7bf4acb3cd79ca675a627e8c009db820e0f46da301edfee10a9aba` |
| `package-lock.json` | `c45192f12910443dfe1b188552ea2304e2e3f08a7ee6f8dbd8f7d831802422d5` |
| `scripts/check-repository-privacy.mjs` | `4eee011bc8278edfb0a2285991f849e001b584b2b6c0c7606fac34abd3fdbee6` |
| `fix-plan.md` | `785a316c3aad2420eaafd2ae656bed1ac9222e3c29ddba51a6b4f97d0ec09085` |
| `test-plan.md` | `22a181b962ae10d9ef5acea1dbaf9723754432aee85b67be0584055e3eec9bb7` |
| `critique.md` | `97a0b6af0680ff1249d8677ceefc549b6ea8abb9fd3c8e0fdc75abbbbb44b42f` |
| `record.json` observed after execution | `e0583729e4e7d3adacf1626814c1516bd090aba075baf12f18aae64ef1d5a33c` |
| `tests/ai-ui-fixture.ts` before | `dacfab9d86cabec4e6d841dd9470bbb5faf6ba871010ffaaaf9689cf8765e1fb` |
| `tests/ai-ui-fixture.ts` after | `66613fd5853a0a4f1fc56259fb9375de4c80dcbc37860164fa084b629f8273ef` |

No material unit/integration failure was found. This artifact grants no automatic deployment or subsequent workflow-stage receipt; root retains that decision and the remaining verification work.
