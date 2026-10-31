# @codraoss/ai-cli-integration

Reusable Codex CLI and Grok CLI integration for Node.js hosts. The package separates browser-safe contracts from the local process boundary so it can be adopted by another application without importing Codra's dashboard, database, Worker, or Content features.

## Ownership

The root export is browser and Worker safe:

- settings schemas and invariants;
- normalized engine, model, reasoning, and catalog types;
- pure Codex and Grok catalog parsers.

The `@codraoss/ai-cli-integration/node` export owns:

- executable resolution through explicit overrides, environment variables, `PATH`, and standard user-local locations;
- live version/model discovery;
- fixed argument construction with `shell: false`;
- bounded subprocess output and timeouts;
- read-only structured Codex/Grok execution;
- verbatim, tool-free Grok structured execution with a two-turn ceiling so an
  internal prompt-file read can complete without opening an unrestricted agent
  workflow;
- temporary schema/output files with guaranteed cleanup.

The package never stores credentials. Codex and Grok continue to own their existing local sign-in state.

## Loopback catalog runner

Build the package and launch:

```bash
npm run build -w @codraoss/ai-cli-integration
node packages/ai-cli-integration/dist/node/server.js
```

It binds only to `127.0.0.1:8798` and exposes:

- `GET /health`
- `GET /v1/catalog`

There is deliberately no browser execution endpoint. A trusted host imports `executeStructuredCli` directly.

Configuration:

- `CODRA_CODEX_EXECUTABLE`
- `CODRA_GROK_EXECUTABLE`
- `CODRA_AI_CLI_RUNNER_PORT`
- `CODRA_AI_CLI_ALLOWED_ORIGINS` as a comma-separated exact allowlist

## Host integration

```ts
import { cliIntegrationSettingsSchema, cliSettingsIssue } from '@codraoss/ai-cli-integration';
import { executeStructuredCli, inspectCliCatalog } from '@codraoss/ai-cli-integration/node';
```

A host supplies:

1. Durable settings persistence.
2. Authenticated settings API routes.
3. A UI adapter using its own design system.
4. A trusted Node process that imports the Node entry point.

Do not expose arbitrary executable paths, arguments, prompts, or working directories through an unauthenticated HTTP endpoint. Validate the selected engine/model/reasoning tuple against both durable authorization and a fresh catalog before execution.
