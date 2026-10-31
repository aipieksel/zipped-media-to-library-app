# Revision 9 — independent companion security and correctness review

Date: 2026-10-31. Reviewer: `/root/ai_app_assessment`. Implementation owner: `/root/ai_auth_research`. Workflow: GVS, with the security-verifier handler and its command/source guidance read in full from the workflow 3.1.0 local mirror. Scope is the companion, its modified process adapter, and the shared AI request/prompt contracts. The reviewer did not implement these modules. The previously implemented saved-artwork parser is not presented as independently reviewed here.

## Outcome

**Four material findings were reproduced and corrected during this review. Their targeted closure checks pass. No remaining material blocker was identified in the reviewed companion paths at the source hashes below.** This is a bounded code and fixture assessment, not a claim that the user's OpenAI account has been tested.

The current fixed configuration was also submitted to the actual official Codex CLI 0.166.0 installed by the root agent. Strict parsing and the configuration RPCs succeed. The effective-policy validator then correctly refuses this environment's required managed hooks with `ISOLATION_UNSUPPORTED`. No managed policy was weakened. No login, account credential read, model discovery, provider request, or real inference was performed by this reviewer. The account and attached-image success test therefore remains for the user's paired local companion.

## Scope and boundaries

Reviewed `companion/*.ts`, the reachable modified Node process/spawn/answer-file adapter, `src/ai/contracts.ts`, `src/ai/prompts.ts`, and the focused companion fixtures. Browser UI, hosted identity, deployment, and saved-library implementation have separate reviews. No source edits, dependency changes, build, or Git mutation were performed for this review; only this report was written.

The authorized boundary is a single-user loopback service. Its bearer token authorizes the paired Folio origin to submit one bounded image/SVG operation or a small connection test. The HTTP interface must not expose a generic command runner, executable path, working directory, arbitrary configuration overrides, or provider credentials.

| Actor and object | Allowed action | Boundary examined | Evidence |
| --- | --- | --- | --- |
| Unpaired site or missing/incorrect token | None of status, generation, test, or cancellation | Exact Origin and Host, timing-safe token comparison, loopback binding | HTTP negative cases fail before fixture driver calls |
| Paired Folio page | Selected PNG attachment plus bounded SVG/instructions | Strict schema, fixed operation, size/dimension limits, no executable/cwd/args fields | Schema rejection tests and driver attachment fixture |
| Local CLI account | ChatGPT-authenticated operation only | Positive auth status plus invocation-level forced login method; API-key environment excluded | C2 regression and API-auth fixture rejection |
| Model output | Bounded structured SVG candidate | Successful terminal event, forbidden tool-event abort, bounded regular answer file, shared strict SVG sanitizer | Incomplete/tool/unsafe-SVG/oversize cases rejected |
| Cancellation, disconnect, or timeout | Stop active work before the next job or cleanup | Abort propagation, process-group stop, hard-kill fallback, close-before-removal | Child ignoring SIGTERM, overflow, and HTTP cancellation/deadline fixtures |

The selected security guidance was OWASP WSTG **v4.2**, specifically [authorization boundary testing, WSTG-ATHZ-02](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema/) and [command injection testing, WSTG-INPV-12](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/07-Input_Validation_Testing/12-Testing_for_Command_Injection/). These were applied to the bounded local endpoint and process invocation; this is not full WSTG/ASVS certification.

## Findings and closure

### C1 — P1: incomplete pre-inference built-in tool restrictions

**Original evidence.** The fixed configuration initially disabled shell/apps/plugins/hooks and structured code mode, but omitted browser/computer/subagent/image-generation/current image-view feature gates. A synthetic effective snapshot with `browser_use`, `computer_use`, `multi_agent`, `image_generation`, and `view_image` enabled passed `validateCodexConfiguration`. The post-start event guard could reject an eventual result but did not establish that those tools were unavailable before the model began.

The current official [feature registry](https://github.com/openai/codex/blob/main/codex-rs/features/src/lib.rs) exposes separate feature controls for those families. The current image-view key is `features.view_image`; it is not the obsolete `tools.view_image` key discovered in C3.

**Correction reviewed.** `companion/isolation.ts` now emits and checks the explicit supported false gates, including browser external/CDP access, agent variants, structured code-mode controls, image generation/viewing, plugins/hooks, and related discovery/dependency features. `agents.enabled=false` is fixed. Conflicting managed feature requirements and any contradictory exposed reported tool gates reject before model discovery or inference. The event guard remains an additional enforcement boundary.

**Closure evidence.** The C1 fixture rejects enabled or missing gates and required feature conflicts. The driver fixture proves no inference begins for an effective browser-tool conflict. The complete current override set passes strict parsing in official CLI 0.166.0 after C3 was removed. **Closed for the reviewed supported controls.**

### C2 — P1: account status alone did not constrain the later inference authentication mode

**Original evidence.** The code accepted only a positive earlier ChatGPT status and removed API-key environment variables, but the independent generation invocation did not set `forced_login_method`. This left the stated no-API-fallback guarantee dependent on a prior process's account observation rather than an enforced condition of the generation process. No billed request or actual account switch was attempted.

The [official configuration reference](https://developers.openai.com/codex/config-reference) documents `forced_login_method` with `chatgpt` and `api` values; the [ConfigToml source](https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs) defines the same control.

**Correction reviewed.** Every fixed invocation includes `forced_login_method="chatgpt"`; the reconstructed configuration must retain it, reported configuration must not contradict it, and managed allowed-login methods must include ChatGPT.

**Closure evidence.** Spawn-spec assertions require the fixed override. Pure negative cases reject `api` and missing values. A fixture that first reports ChatGPT status and subsequently reports API-only effective configuration is rejected before the fake inference starts. The actual 0.166.0 configuration RPC reports the expected ChatGPT-only setting. **Closed as an invocation/configuration guarantee; actual account inference remains untested.**

### C3 — P1: obsolete image-view override prevented all current-CLI connections

**Original evidence.** With newly created empty child `HOME` and `CODEX_HOME`, actual official CLI 0.166.0 immediately rejected the then-current fixed overrides:

```text
Error: unknown configuration field `tools.view_image` in -c/--config override
```

This happened before configuration RPC initialization. The synthetic executable had accepted the invented compatibility surface, so fixture success alone did not reveal the failure.

**Correction reviewed.** Removed the obsolete override and the matching raw-layer requirement. The independently required current `features.view_image=false` control remains. The spawn regression explicitly asserts that the obsolete key is absent.

**Closure evidence.** The unmodified current `fixedCodexOverrides` output is accepted by official CLI 0.166.0 under `app-server --strict-config --listen stdio://`; initialize, `config/read`, and `configRequirements/read` complete. **Closed for that installed version.** Other versions still require runtime capability checks and must fail closed when unsupported.

### C4 — P1: configuration layers were merged in the wrong precedence order

**Original evidence.** Actual 0.166.0 `config/read` returned highest-priority layers first: `sessionFlags`, `user`, `system`. The validator iterated that list with a last-write-wins merge. Two direct counterexamples established both effects:

| Highest-first snapshot | Original result | Required result |
| --- | --- | --- |
| Session flags disable browser access; lower system layer enables it | Rejected | Accept the fixed effective setting |
| Higher legacy-managed layer enables browser access; lower session flags disable it; reported effective browser access is enabled | Accepted | Reject before inference |

The [official protocol source](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/config.rs) assigns session flags precedence 30 and legacy managed file/MDM precedence 40/50. Thus the second example represents a genuine higher-priority override, not an arbitrary fixture ordering.

**Correction reviewed.** The validator merges a reversed copy of the RPC layers, retaining all per-layer rejection checks. Fixtures now use actual highest-first ordering. The validator also rejects exposed effective tool fields that disagree with its reconstructed policy.

**Closure evidence.** Both precedence counterexamples now have the required results. A third case rejects a contradictory reported tool gate. The actual 0.166.0 probe still reaches the expected managed-hook rejection rather than misclassifying the fixed controls. **Closed.**

## Independent verification results

Executed after the C1–C4 corrections:

```text
node --import tsx --test --test-reporter=spec \
  tests/ai-companion.test.ts tests/ai-companion-http.test.ts

tests 19; pass 19; fail 0; cancelled 0; skipped 0
```

The default execution sandbox blocked loopback listening (`EPERM`) and the disposable child fixtures' expected output. Those failures were recorded as test-environment restrictions. A permitted rerun with local subprocess/loopback capability passed the complete 19-test set. All tests used disposable fake CLI executables and synthetic source data; the permission change did not authorize or perform real provider inference.

The independent actual-CLI capability probe used a new empty child configuration and home on every run, deleted after the check. It called the existing `readCodexConfiguration` with the current fixed overrides, then the existing validator. Safe diagnostic outcome:

```text
strict configuration RPC: success
layer types: sessionFlags, user, system
validation: ISOLATION_UNSUPPORTED
reason: required managed hooks conflict with the isolated operation
```

This verifies real strict parsing, protocol shape/order, and truthful rejection of an incompatible managed setup. It does not verify a successful real inference, account eligibility, model discovery, image understanding, or SVG quality. The CLI's own provider/network and account behavior was not replaced with a weaker fallback.

## Residual limits

- A successful authenticated text test and an attached-image SVG task on the user's actual computer remain unverified. The UI/README must retain that distinction.
- The configuration compatibility probe was Linux/CLI 0.166.0. Windows executable discovery, Windows descendant termination, macOS behavior, and other CLI versions were not exercised.
- Fixture-level HTTP tests verify the local service boundary; they do not prove the hosted browser's loopback permission prompt, HTTPS-to-loopback access, or a user's denied-permission recovery.
- The local account owner and CLI binary/configuration are trusted host components. This review does not claim resistance to a malicious replacement CLI or a hostile same-user process.
- Strict SVG syntax validation and successful generation are separate from native-size pixel comparison. The companion does not assert pixel-perfect output; the browser owns the independent comparison of the returned candidate.

## Reviewed source identity

The root reported the saved-library milestone `687fa55`; companion corrections were still part of the working changes. No Git operation was used by this reviewer. These SHA-256 hashes identify the exact reviewed files and permit later drift checks:

```text
c8f308c9015f102758329fa4ce9e99b1de49cbba566b234c6a919517d52d3979  companion/isolation.ts
a8e7a387b0330a4484fdbe03d4e8c0cd17218fef6af81f8f5e549016de03e8dd  companion/codex.ts
f14f4427a3d6dc3daea8d0f568ab1346839d31802568bb6df02b566fcd1c4cef  companion/server.ts
e937d38094c1635b418896568dacf383e652b1a36a181c7f6813e256fabda28b  companion/errors.ts
b0045ff11d42b6a6b30ccef80cec030efa11552cb479b01f776c2ad19afcb3bc  companion/index.ts
a8b123aaa23228454b24cfd771492d6c6492eb529ca4aeaa71fdc35c05a9f817  vendor/ai-cli-integration/src/node/process.ts
0ca1c101bacb1c15c7a758e622fbe18df7c43a60a1a61929a70de3590c4d4e52  vendor/ai-cli-integration/src/node/spawn-spec.ts
90e9e2645c5dee15f18fb75a63efba45db5826490c5d28670e5cf2c95bd02bac  vendor/ai-cli-integration/src/node/execute.ts
d6a0e2326418cf64dcdfd2f633ac3ef89d8b6310c3de44458ec85ce549b8b8c2  vendor/ai-cli-integration/src/node/executables.ts
af33e4c991966ead456539a053c8b9f74405956cb675b4af914d451f5fc345f8  src/ai/contracts.ts
d9cb66a0313557428bb44cc7bf7619b19513eff5c4fb53f2425ee98acc44887a  src/ai/prompts.ts
97ce1a96b457696ccaa4cd69067bf9a32e16d846acd46cb446560bcb5aa5081c  tests/ai-companion.test.ts
ceef55ffed6349d0b6f6655aba8d698d11125cd0c1adb061486a43cceaeb7c1a  tests/ai-companion-http.test.ts
```
