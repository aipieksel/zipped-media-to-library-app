# AI CLI integration package — read-only assessment

Date: 2026-10-31. Assessor: `/root/ai_package_audit`. Scope: the source-only extraction of the user-supplied `ai-cli-integration.zip` at `/workspace/scratch/6d5f921cc245/package-review`. The parent owns the Folio repository, task record, implementation, Git, builds and publication.

## Outcome

The package is a useful CLI adapter foundation, but it is not a complete browser-to-AI service. It supplies browser/Worker-safe settings and catalog contracts and a Node-only process adapter for exactly **Codex and Grok**. The supplied loopback server exposes discovery only. It does not implement browser execution, sign-in, app accounts, image attachments, or image generation/editing. A hosted Folio page cannot run this Node adapter or automatically use a signed-in CLI on the user's Mac without a local trusted companion connection.

The smallest compatible integration is a shared Folio AI service contract in the frontend plus an authenticated loopback Node companion that owns fixed CLI invocation, provider settings and per-request temporary files. Codex can then use whichever local authentication the installed CLI officially supports. Real account authentication and an actual successful model request must be verified separately from catalog availability. The package's current source is not sufficient evidence of that live account state.

## Inspected source and exclusions

Read all 10 package source files, both test files, README, package manifest, build/TypeScript/Vitest configuration, lockfile root/runtime dependency metadata and the license declaration/text header. The license file is retained unchanged in the extraction. The root manifest is `@codraoss/ai-cli-integration` version `0.1.0`, `AGPL-3.0-only`; its only runtime dependency is Zod, specified as `^4.3.6` and locked to `4.4.3` with MIT metadata.

Generated `dist`, bundled `node_modules`, macOS metadata and archive directory entries were excluded by the parent extraction. No package code, dependency script, tests, CLI, authentication probe, network request or user-account operation was executed. This is source evidence, not a runtime security certification or compatibility test. No Folio source was inspected for this particular assignment.

Read the AI Development Workflow GAS, GAA, GVS and specialist-contract instructions. The cloud agent-resource paths failed to resolve; the matching codebase-assessor, architect and security-verifier profiles were found and read from the installed 3.1.0 plugin. No separate workflow or task record was created by this assessor.

## Source-backed integration contract

| ID | Scoped requirement | Existing source evidence | Owner to reuse | Constraint and decisive verification |
| --- | --- | --- | --- | --- |
| C1 | Shared AI settings | `src/contracts.ts`: `cliIntegrationSettingsSchema`, `cliProviderSettingsSchema`, `defaultCliIntegrationSettings`, `cliSettingsIssue` | Browser-safe root package export | Reuse the normalized settings types, with host persistence and authorization. All providers default disabled. An enabled provider requires model and reasoning; default engine must be enabled. Do not mistake this logical settings check for live model authorization. |
| C2 | Actual providers | `cliEngines = ['codex', 'grok']` and corresponding strict settings keys | Package engine enum/catalog | OpenAI should be described as Codex CLI when this adapter is selected. There is no DeepSeek engine. Do not render DeepSeek as a functioning provider from this package alone. Grok account/billing behavior is also not established by this source. |
| C3 | Live model selection | `src/node/discovery.ts`: `inspectCliCatalog`, `inspectEngine`; `src/catalog.ts` parsers | Node discovery and browser-safe catalog parser | Codex discovery runs `--version` and `debug models`; Grok runs `--version` and `models`. Verify those exact commands against the intended installed CLIs. Model parsing is provider-specific. Availability is executable/model discovery, not proof of account login or generation. |
| C4 | Existing account authentication | README ownership; `safeCliEnvironment`; executable resolution | The installed CLI's official local sign-in/configuration | Package never stores credentials and has no login/status/logout/account/password function. A host must not request or copy OpenAI credentials into Folio browser storage. A live account test requires the intended CLI host/session, not this extraction or a remote agent environment. |
| C5 | Node/Worker separation | Root exports `contracts`/`catalog`; `src/node/index.ts` exports filesystem/child-process code | Keep package subpath boundary | Only root contracts/parser belong in browser or Cloudflare Worker bundles. `node:child_process` execution belongs in a trusted Node process with a local CLI. Do not add the Node export to the hosted Worker build. |
| C6 | Browser transport | `src/node/server.ts`: fixed `127.0.0.1`, port8798 default; GET `/health`, GET `/v1/catalog` only | Discovery runner may inform a companion, not serve as an execution endpoint | No browser execution endpoint exists. A new authenticated local request boundary is a real integration prerequisite. Hosted HTTPS-to-loopback browser behavior, exact allowed origin and any Local Network Access flow need intended-browser verification. |
| C7 | Safe process invocation | `buildStructuredCliSpawnSpec`; `runCliProcess` with `shell:false` | Fixed argument-array construction | Keep executable, cwd, schema paths and extra arguments host-owned. Fresh provider/model/reasoning tuple authorization is required; package only checks model syntax and a global effort enum. No arbitrary executable/cwd/argument endpoint. |
| C8 | SVG cleanup/recreation input | `ExecuteStructuredCliInput` has only text `prompt`, cwd and schema | Shared generation contract, with a focused input extension | Existing SVG text can be supplied as data. There is no `imagePaths`, attachment, data-URL or raster buffer input, and no CLI image flag. A source image must be attached through a verified supported adapter feature; mentioning its filename in a prompt is not proof that a model saw it. |
| C9 | Structured SVG output | `execute.ts`: `parseStructuredOutput`, `unwrapStructuredOutput` | Adapt current generic structured-response handling | Direct Codex `{svg:...}` can fall through as an object, but Grok's nested `{text:'{"svg":...}'}` is not unwrapped because the only recognized terminal object has `html:string`. Correct and test generic schema-driven SVG envelopes. Validate output with the host's actual schema; TypeScript `as T` provides no runtime check. |
| C10 | Time, cancellation and output limits | `process.ts`: 30s default/4MiB output; `execute.ts`: 300s default | Existing process lifecycle, corrected for the new host | Timeout sends SIGTERM and waits for `close`; an uncooperative child can remain pending. Output overflow rejects immediately without awaiting exit. Codex output-file read is unbounded. Implement bounded completion/kill escalation, request cancellation and bounded file reading before exposing execution. |
| C11 | Local process security | Codex args include `--ephemeral --sandbox read-only`; Grok adds tool/subagent/search restrictions | Provider-specific least-privilege spawn policy | Read-only is not tool-free or filesystem-read isolation. Codex is not explicitly prohibited from inherited MCP/tools in this source. Inspect intended CLI configuration and isolate job data; image/SVG prompt contents remain untrusted input. |
| C12 | Safe SVG preview/save | Adapter returns unvalidated generic JSON; it has no SVG sanitizer or renderer | Folio must own the SVG document boundary | Reject active SVG content, external resources and unexpected document structures before preview/persistence. Verify actual preview/download bytes. An AI-created SVG must not inherit the converter's zero-difference badge without a new independent native render comparison. |
| C13 | Persistent icon library and recolor | No database/library/color APIs anywhere in package | Existing Folio storage/render/export owners, assessed separately by root | This is host application work. Keep originals and accepted AI results distinct, retain provenance, and verify save/reload/recolor/download behavior. The package cannot supply these features. |
| C14 | Shared Images integration | No image editing or generated binary-output contract | Shared frontend AI request and provider-capability layer | Design reusable asset/task contracts, but expose only verified capabilities. The supplied package does not establish raster image editing or an image model backend. SVG generation from a supported image input is a separate capability from producing an edited PNG/WebP. |
| C15 | App login/profile/password | No identity/account/auth routes or UI | Existing Folio/Site identity owner, assessed separately | Keep app account identity separate from CLI provider authentication. Do not implement a browser-local password facade or claim that editing a Folio profile changes the OpenAI account. Password handling should use the actual app identity provider's supported mechanism. |
| C16 | Dependency/source provenance | `package.json`, `LICENSE`, `package-lock.json`, `tsup.config.json` | Retain supplied package license and source provenance | Preserve AGPL license and notices if integrating this source. Do not relabel copied package code as MIT. Existing Folio license and complete distribution implications are outside this source-only audit. Bundle from reviewed source; do not execute the uploaded node_modules or trust uploaded dist as the release. |

## Concrete findings affecting the new flow

### P1 — nested non-HTML output is not normalized

In `src/node/execute.ts`, `unwrapStructuredOutput` returns a record only when `record.html` is a string. Its recursion visits familiar envelope keys, but a nested `{svg: '<svg ...>'}` has neither `html` nor another recognized envelope key and becomes `null`. `parseStructuredOutput` then returns the outer envelope. Thus the documented Grok text envelope works only for the existing HTML example; changing the requested schema to SVG is insufficient. A direct object is accepted without runtime schema validation. The package tests cover an HTML envelope only.

This should be fixed using a host-supplied output validator, or an explicit bounded envelope normalization followed by schema validation. It should not be “fixed” by accepting arbitrary outer objects or renaming SVG content to `html` merely to satisfy the hard-coded parser. Regression cases should cover direct SVG JSON, wrapped SVG JSON, arrays/envelopes, malformed JSON and valid JSON of the wrong schema.

### P2 — timeout and cancellation do not guarantee completion

`runCliProcess` sends SIGTERM at the deadline, but only the eventual child `close` event rejects for timeout. The timeout handler does not itself settle, escalate to SIGKILL or handle a process group. A CLI that ignores SIGTERM, or descendants that retain pipes, may leave the promise unresolved. On output overflow, the promise rejects immediately after SIGTERM; `executeStructuredCli` then removes its temporary directory before the child is confirmed gone. No AbortSignal exists; `onSpawn` exposes the child but leaves lifecycle behavior to the host.

The companion needs a bounded cancellation contract and final cleanup after process termination. Relevant regression controls include a child that handles/ignores SIGTERM, an aborted queued/active job and a late output attempt. This finding is source-confirmed control flow, not a live process test.

### P3 — output/schema bounds are incomplete

The 4MiB cap counts stdout and stderr together. Codex returns its actual answer through `output.json`, which is read with unrestricted `readFile`. There is no size/type check before allocation and no runtime validation against `input.schema` afterward. The caller-controlled schema is only serialized and passed to the CLI. A prompt can be up to one million characters and is passed in argv; that is larger than practical single-argument limits on some hosts and exposes prompt content to local process-list inspection. A structured companion request should apply lower explicit payload/output budgets, pass prompt content through a supported stdin or bounded job-file interface, and avoid logging private source payloads.

### P4 — the provided server must not simply gain an unauthenticated POST

The current read-only server uses an exact Origin allowlist but accepts requests with no Origin. It has no authentication, host-header validation, pairing, durable settings authorization, execution route, concurrency control or catalog caching. Every catalog request can launch four discovery subprocesses. These choices are not claimed as a remote-execution vulnerability in the existing discovery-only server. They become important when adding the requested execution capability.

The host should bind loopback, require a pairing/authorization token for protected operations, validate the intended browser origin and loopback Host, make job IDs/cancellation scoped to that connection, and reject arbitrary command/cwd/executable/schema fields. Only fresh approved model/reasoning selections should execute. Cache catalog results with bounded refresh behavior so UI rendering cannot trigger uncontrolled process churn. Browser authorization and local network behavior need actual host evidence.

### P5 — provider settings and CLI sandbox labels need honest interpretation

`cliSettingsIssue` enforces local invariants, not catalog membership. `buildStructuredCliSpawnSpec` validates model syntax and the global effort enum, not whether that provider/model supports that effort. At runtime an invalid engine value reaching the function falls into the Grok branch, because the enum is only a TypeScript type there. Host HTTP inputs therefore require strict runtime schemas and a fresh catalog check.

Codex gets a read-only sandbox but not an explicit tool-free configuration. A working directory limits job organization, not necessarily all readable filesystem paths. The adapter must be evaluated with the intended installed CLI configuration before calling the new browser endpoint “isolated.” Grok explicitly receives empty tools, no subagents, no plan and disabled web search, but compatibility of these arguments with the intended Grok CLI remains untested.

## Smallest viable component boundary

The recommended shape is one shared frontend AI client and settings model, with task-specific SVG prompt/output handling above it. Icons can offer an AI action beside the existing conversion result and preserve the accepted result as an explicitly saved library item. Images can reuse the selected-asset request contract and capability checks rather than starting a second provider-settings implementation.

A loopback companion owns all local CLI interaction. It should present sanitized availability, supported models/efforts/capabilities, and last actual test/generation state. Credentials remain with the vendor CLI. The companion validates selected provider/model and incoming source limits, creates an isolated per-job directory, invokes only the fixed adapter, normalizes and validates the result, and returns bounded SVG data/provenance. No browser request supplies arbitrary executable paths or arbitrary local filenames.

App login/profile/password remain with the actual Folio/Site identity system, whose existing implementation is not assessed in this artifact. A settings page may present app identity and provider connection in separate tabs while reusing current navigation components. A provider “connected” badge must not derive solely from CLI installation or a public model list.

This is architecture advice for the root planner, not an implementation sequence or independent authorization. The live OpenAI test cannot be marked complete until the intended user-account CLI host is connected and a real bounded request succeeds.

## Existing tests and verification gaps

The package contains eight authored tests: four contracts/catalog cases and four Node adapter cases. The latter cover fixed Codex arguments, Grok tool-free flags, shell interpolation resistance and an HTML-only Grok text envelope. No tests were executed by this assessor. The inspected tests do not cover an actual OpenAI/Grok login or generation, browser transport, SVG/image input, output schema/size validation, timeout escalation, cancellation, model tuple authorization or saved/recolored SVG export.

## Fingerprints

| File | SHA-256 |
| --- | --- |
| package.json | `8c8eea3044b69a6e9bc25a69afbf666961fcdb0aa9354fa9e4ab78cd475b74d6` |
| package-lock.json | `026d27fcb8559605f0eb11c3c996a4f3e88c6cedc558d0694eebc1e5f7c36a64` |
| LICENSE | `610afa2c343f2bdb373e94fe75e9238d5d8e79f8a4d6381fce0a1b69c714ddf2` |
| src/node/execute.ts | `037828e96c718a0b1b75ffbf601cadeed9db73ec5a101cc1cd888d6ec24cf9df` |
| src/node/process.ts | `3509d9d749b7719f7fe97ba2cddaafa43f68e60672b7d31f4281fbef0573cbb0` |
| src/node/spawn-spec.ts | `af14f553fd2f3e16e8ab79b1a51e2099dfdc4a67f3b4fdcd6b071bd124aa88bc` |
| src/node/server.ts | `0cb1826cd601f2b7de66732aef1d0be53cba895fef3771c6085a2436ad73ed30` |

Only this assessment artifact was created. No application/package source, settings, credentials, installed package, account, Git ref or deployed service was changed.
