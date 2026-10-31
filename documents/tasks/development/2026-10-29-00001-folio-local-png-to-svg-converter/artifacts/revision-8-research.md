# Folio AI account integration — bounded research

Date checked: 2026-10-31 UTC. Scope: the supplied CLI package, current first-party account/CLI documentation, and the hosted Folio-to-local-computer boundary. This is read-only research, not evidence that an account is connected or an inference has succeeded.

## Recommended decision

Use a **local, explicitly paired Node companion** for the supplied package, with OpenAI through the user's locally signed-in Codex CLI as the first image-to-SVG implementation. Keep browser-safe provider contracts and the shared AI UI in Folio. Keep subprocess execution and provider credentials on the user's computer. The Cloudflare Worker cannot run the package's subprocess adapter.

Treat the companion as a narrow application service: accept a validated SVG-recreation operation, source image, existing SVG, and selected supported model/effort. Do not expose arbitrary executables, CLI arguments, working directories, or generic process execution to the browser. The hosted page needs a real pairing connection and browser loopback permission before it can use this service. Merely installing the npm package in the web app will not connect the user's account.

Implement and test this first, preserving an adapter boundary for other providers. Do not advertise arbitrary image generation/editing as a capability of an SVG text-generation adapter.

## Observed local package

Source root: `/workspace/scratch/6d5f921cc245/package-review` (source extracted from the user's ZIP; bundled dependencies/build artifacts were not executed).

| Observation | Evidence | Consequence |
| --- | --- | --- |
| Package is `@codraoss/ai-cli-integration` 0.1.0, licensed AGPL-3.0-only. | `package.json:2-5` | Preserve the package license/notices if vendoring. This research does not determine the licensing obligations of a combined distribution. |
| The only engine IDs are `codex` and `grok`. | `src/contracts.ts:3` | DeepSeek is not implemented. Provider names must describe actual adapters. |
| Discovery invokes Codex `debug models` or Grok `models`, plus version lookup. | `src/node/discovery.ts:22-38` | The model menu can come from the user's installation; a populated catalog is not an account inference test. |
| The HTTP runner binds loopback and offers only `GET /health` and `GET /v1/catalog`. | `src/node/server.ts:5-58` | No browser generation endpoint, pairing, or authentication implementation exists in this server. |
| The supplied execution API has a text prompt and schema but no image attachment field. | `src/node/execute.ts:8-18`; `src/node/spawn-spec.ts:6-18` | Image-to-SVG needs a deliberate attachment extension, not a text filename or base64 text pretending to be vision input. |
| Codex uses ephemeral/read-only execution, schema output and a final-message file. | `src/node/spawn-spec.ts:35-45` | Useful starting point, but read-only filesystem access is not equivalent to no tool access. |
| Grok uses `--tools ''`, read-only sandbox and flags disabling web/subagents/plan. | `src/node/spawn-spec.ts:50-65` | The effective toolset still needs verification; empty tools is not established as a full isolation boundary. |
| Structured output is JSON-parsed then cast to generic `T`. | `src/node/execute.ts:54-85` | Folio must perform runtime output-schema and SVG validation. A TypeScript type does not validate model output. |
| Credentials remain owned by the CLI; the host supplies durable settings, routes and UI. | `README.md` | Do not scrape browser cookies or read/export local CLI credential files to Folio. |

## Verified primary documentation

All URLs below were retrieved on the date above. Current documentation can change; validate installed CLI versions before enabling an adapter. No external implementation was copied and no installation command was run.

### OpenAI authentication

Official [Codex authentication documentation](https://developers.openai.com/codex/auth) currently redirects to [ChatGPT Learn authentication](https://learn.chatgpt.com/docs/auth). It documents ChatGPT subscription sign-in separately from API-key billing. `codex login` opens the official browser flow; `codex login status` reports the selected authentication method. Codex maintains and refreshes its own local credentials. The browser's ChatGPT session and a CLI's authenticated state are distinct. The docs advise against exposing Codex execution in public or untrusted environments.

**Inference:** using a locally installed, signed-in CLI through a private companion can meet the user's account preference without putting an OpenAI API key in Folio. A cloud sandbox's CLI state cannot establish that the user's own computer/account works.

### Codex inputs and response contract

The official [CLI reference](https://developers.openai.com/codex/cli/reference) redirects to [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli). Current `codex exec` supports `--image` for initial image attachments, `--output-schema` for expected JSON output, `--output-last-message`, `--ephemeral`, and `-` for a prompt read from stdin. `--ignore-user-config` omits the user configuration while retaining authentication. Model discovery through `codex debug models` is documented as experimental; `--bundled` can return a bundled catalog.

**Recommendation:** attach a validated temporary PNG representing the source pixels, including sources imported as WebP. Supply the source dimensions and existing SVG as bounded text; use stdin for substantial prompts. Inspect `--help`/version locally before relying on newer flags. A catalog entry is not proof that the selected account may use that model.

The official [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) documents `features.shell_tool` as the command-execution switch, `web_search` disabling, MCP enable/disable settings and restricted filesystem permission profiles. Disabling shell tools alone does not establish that all integrations, hooks, browser tools or configured MCP servers are absent. The runtime must enforce and test the actual allowed toolset; a prompt asking the model not to use tools is insufficient.

### App-server alternative

The [official app-server guide](https://developers.openai.com/codex/app-server) documents JSONL stdio, typed image inputs including `localImage`, per-turn output schemas, and explicit restricted read-access roots. Its default read-only access is broad. TCP WebSocket transport is described as experimental and unsupported, with separate authentication options and warnings for remotely exposed listeners.

**Recommendation:** the existing CLI `exec` adapter is the smaller initial change. If app-server is selected for richer sessions/cancellation later, keep it behind the companion over stdio and handle errors, approvals, cancellation and terminal completion explicitly. Do not connect an arbitrary hosted page straight to an unauthenticated app-server listener.

### New Sign in with ChatGPT plan-token route

There is now a documented [ChatGPT plan-usage route for open-source/local apps](https://developers.openai.com/siwc/token-sharing-open-source). It grants eligible model requests after user consent, not access to existing ChatGPT conversations. The documentation directs paid or remotely hosted applications to an interest/access path. Consequently this is not a ready-made hosted Folio credential flow simply because the attached package can call Codex.

The [registration/sign-in guide](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) describes dynamic registration, a stable installation identifier, loopback callback, state/PKCE/nonce validation and granted-scope checks. Identity permission and permission to consume ChatGPT plan usage are separate. An application adopting this flow must own secure token storage, refresh and session lifecycle. This is substantially more credential-handling scope than reusing CLI-managed sign-in.

The [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) require streaming, nonstored Responses requests and accept image inputs only where the selected model supports them. **Image generation is explicitly unsupported on this particular plan-token route.** It can support text SVG reconstruction from images; it does not establish a general PNG-editing service. These limitations describe that route, not every feature of ChatGPT or every provider.

### Grok and DeepSeek

[Official Grok CLI reference](https://docs.x.ai/build/cli/reference) documents `grok login`, `grok models`, model/effort selection and CLI integration. [Official headless documentation](https://docs.x.ai/build/cli/headless-scripting) describes existing local authentication or API-key authentication and structured process output.

The publisher's [headless guide in xai-org/grok-build](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/14-headless-mode.md) says built-in-tool filtering leaves MCP meta-tools available unless denied. Therefore the supplied adapter's `--tools ''` must not be represented as a verified no-tools boundary. This research did not establish the exact installed Grok version, image block behavior, effective isolation, or the user's Grok entitlement. Keep execution capability-gated until tested.

DeepSeek has no adapter in the supplied package. Omit it from usable choices or identify it as unavailable; do not create a successful-looking configuration for a nonexistent integration.

### Cloudflare and browser boundary

[Cloudflare Workers Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) lists `node:child_process` as a nonfunctional stub, even when Node compatibility enables importability. The trusted Node subprocess host must run outside the Worker. Its `127.0.0.1` address is the user's computer only when contacted by the user's browser; a server-side fetch would target the server's own loopback.

Chrome's current [Local Network Access guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access) documents a loopback permission boundary for public-site requests to localhost. Use an explicit user action, a secure top-level page and `targetAddressSpace: 'loopback'` where supported. CORS still applies. Current guidance advises against new legacy PNA header workarounds. Cross-origin iframe embedding also requires appropriate permission delegation. Feature-detect carefully and handle rejected/unsupported permission queries and fetches without claiming the provider is offline. A local development page does not exercise the same permission boundary as the published HTTPS origin.

## Proposed application contract and checks

These are implementation recommendations, not observed capabilities of the supplied package.

1. **Connection:** bind only loopback; validate exact Host and Origin; require high-entropy pairing authorization on catalog and generation routes. Restrict pairing to the actual Folio origin and revoke old tokens on re-pair/disconnect. A pairing token is separate from provider credentials. Do not log tokens or upload them to the app backend.
2. **Operation:** accept an explicit operation such as `recreate-svg` or `clean-svg`; validate provider/model/effort against the fresh local catalog and capabilities. Enforce image format/decoded dimensions, body size, request timeout, bounded output, concurrency, cancellation and temporary-file cleanup. Browser input must not select arbitrary local paths or executables.
3. **Vision/prompt:** send the selected image and existing SVG only after the user chooses AI. Ask for the same design, proportions, viewport, transparency and colors, with cleaner editable shapes and paths where appropriate. Require self-contained SVG without scripts, HTML, external references or bitmap embedding. Treat source SVG/text as untrusted input data. Do not promise that learned reconstruction will be pixel-exact.
4. **Result:** require schema-valid JSON and a parsed, allowed SVG subset before preview. Reuse the existing sandboxed/image preview behavior. Show source/current/AI result comparison on the existing page. Keep the previous asset until the user saves the reviewed result. Saved color changes must modify export geometry consistently.
5. **Honest capability labels:** local conversion remains local; an explicit AI request sends the selected content to the chosen provider through its CLI. “Connected,” “catalog loaded,” “text inference succeeded” and “image-to-SVG verified” are distinct states. Future Images actions should be enabled only for operations their adapter actually implements.
6. **App account versus provider account:** reuse the actual site's identity/session boundary where available. Profile fields and a local preference screen do not create authentication. A provider-managed account should link to its supported security controls rather than collect its password inside Folio. Do not invent a local password form that falsely protects a remotely served app or its stored files.

## Testing that is possible without provider credentials

- Unit/integration tests can validate schema parsing, injected fake CLI process behavior, image attachment arguments, stdin delivery, timeout/cancel/output limits, and cleanup after failure.
- Companion tests can prove unknown Origin/Host/token rejection, blocked path/executable overrides, CORS preflight, size/concurrency bounds and response validation. Confirm denied requests have no subprocess side effects.
- Browser tests can cover connection states, model selection, the original/AI preview, unsafe SVG rejection, persistence and recolor/download behavior with a deterministic mocked companion. They cannot prove a real provider account works.
- A real user-account check requires the companion on the user's computer, a confirmed CLI ChatGPT sign-in, the browser's loopback permission, and a deliberate tiny inference followed by an actual attached-image-to-SVG request. Log only outcome, selected model, elapsed time and sanitized failure. Do not read credential files.
- Confirm source-image presence using a known fixture whose content is not stated in the prompt, and inspect the generated SVG visually. A trivial text response does not prove image support. AI output can be checked for syntax, safety and measured visual differences, but universal pixel fidelity remains unsupported.

## Research execution and remaining uncertainties

Read the AI Development Workflow GRS stage, shared specialist contract, plugins/MCP and infrastructure profiles, and researcher/security-verifier roles. Cloud reads for the two agent profiles failed; their installed 3.1.0 copies were then read from the local skill package. No app/repo files were changed by this research.

No CLI process, authentication status, credential file, login flow, paid request or user browser session was inspected or executed. No package installation occurred. Installed CLI compatibility, real model entitlements, effective tool isolation, the published site's permission headers and an actual end-to-end user-account inference remain verification tasks for implementation and the user's local environment.

## Execution addendum requested during planning

### Do not invent a legacy read restriction

`sandbox_read_only.readable_roots` is not in the current official configuration reference. Do not assume an unrecognized `-c` key is enforced. The documented [permission profile system](https://learn.chatgpt.com/docs/permissions) provides a concrete CLI alternative: define a unique profile with only minimal platform reads plus the job directory, and disable command networking. It must not extend the broad built-in read-only profile. Do not combine this with `--sandbox` or a loaded `sandbox_mode`: the older setting takes precedence. Managed profile allowlists require Codex 0.138.0 or newer; version checking alone still cannot prove effective configuration.

Candidate fixed per-run TOML overrides for the current documented system, expressed as configuration rather than shell-escaped strings:

```toml
approval_policy = "never"
default_permissions = "folio-svg"
web_search = "disabled"
project_doc_max_bytes = 0

[features]
shell_tool = false
apps = false
plugins = false
hooks = false

[tools]
view_image = false

[permissions.folio-svg.filesystem]
":minimal" = "read"
"/absolute/path/to/this/job" = "read"

[permissions.folio-svg.network]
enabled = false
```

Use only documented/runtime-supported keys for the pinned executable. Pass each as a separate `-c` value, use `--ignore-user-config`, an isolated job cwd, `--ephemeral`, `--skip-git-repo-check`, `--json`, explicit model/effort, schema/final-output files, a real `--image` argument, and stdin prompt. Enable `--strict-config` when supported and require unsupported security controls to fail closed. No `--sandbox` in this profile configuration. The trusted Node process writes/cleans job inputs and output; model tools do not need write permission.

The [official managed configuration example](https://learn.chatgpt.com/docs/enterprise/fedramp-api-configuration) confirms switches for plugins and hooks, and uses an empty **managed requirements** MCP allowlist. That does **not** establish that passing `-c mcp_servers={}` clears every inherited source in ordinary CLI config. For a general installed-user setup, inspect the effective configuration internally and refuse activation if MCP, hooks, plugins, or a legacy sandbox override remain enabled. Do not transmit configuration values or credentials to the UI. Per-server `mcp_servers.<id>.enabled=false` is documented, but this research found no global CLI `--no-tools` guarantee.

### Minimal operational verification gate

Record the resolved executable identity and `codex --version`; require the expected `exec --help` features and `--strict-config`. Revalidate when executable identity/version changes. Use a harmless fixture outside the job directory with a unique sentinel to test that the selected sandbox blocks reading it and blocks writes/network. Do not use personal files as fixtures. Inspect only safe booleans from effective config, not token values. A permission-profile conflict is a setup error, not a reason to relax isolation.

For inference, consume JSON events as they arrive and cancel the process immediately on any command execution, MCP call, file change, web search or other unexpected tool item. Reject partial, interrupted, failed, or truncated outcomes even when they contain parseable JSON. This event check is an additional detection layer, **not the filesystem boundary**: a tool may begin before the event is observed. Enforced permissions and absence of external integrations must hold before inference begins.

If effective CLI configuration cannot be checked cleanly on the target version, the concrete fallback is app-server stdio with the same disabled capabilities, a checked config response, and the documented explicit per-turn `sandboxPolicy = { type: "readOnly", access: { type: "restricted", includePlatformDefaults: true, readableRoots: [jobDirectory] } }`. It is more code but avoids guessing CLI-only read-access fields. It still requires external integrations to be absent and generated schemas from the pinned CLI version.

For Grok, leave the adapter unavailable with a precise reason until its exact attachment and tool-exclusion behavior pass equivalent tests. Do not claim a nonexistent global `--no-tools` flag. Discovery can report installed status separately from available Folio operations.
