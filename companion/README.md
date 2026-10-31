# Folio AI companion

The companion lets Folio use your **locally signed-in Codex CLI and ChatGPT account**.
The web app does not receive your OpenAI credentials. Local PNG/WebP conversion
continues to run in the browser; an explicit AI action sends the selected image,
bounded existing SVG and instructions to OpenAI through Codex.

## Setup

1. Install Node.js 22 or newer and the official Codex CLI following
   <https://developers.openai.com/codex/cli>.
2. Run `codex login` and choose ChatGPT. `codex login status` must report ChatGPT,
   not API-key authentication. Folio never substitutes API billing.
3. From the Folio source checkout, run `npm ci`, then `npm run companion:build`.
4. Start `npm run companion` and keep the terminal open.
5. Open Folio → Settings → AI. Enter the displayed pairing code, connect, choose
   an available model/reasoning level, and use Test connection.
6. Allow the browser's local/loopback network permission when prompted. If it was
   denied, change that permission for the Folio site in browser settings.

The default origin is `https://folio-html-workspace.byronjacobs.chatgpt.site`.
For another Folio origin, start with `--origin https://your-site`.
For local development, pass the exact development origin, for example
`--origin http://localhost:5173`. The companion accepts exactly one origin.
Use `--port 8798` to choose a different free port and enter the same port in Folio.
It always binds `127.0.0.1`; do not expose it through a proxy or public tunnel.

Each restart creates a new pairing code and revokes the old one. Keep the code
private. It authorizes this local companion; it is not an OpenAI API key.

## What is supported

- Codex image-to-SVG recreation and cleanup with editable, validated geometry.
- PNG, WebP and JPEG sources normalized locally to a native-size PNG attachment.
- Up to 8 MiB per attachment, 4 megapixels, 4096 pixels per side and 2 MiB of SVG.
- Fresh local model and reasoning choices. An available catalog does not prove
  an inference succeeded; Test connection performs a small real text request.
- Cancellation, one active request, strict config checks, restricted read access,
  no model command/web/app/MCP tools, bounded results and temporary-file cleanup.

Grok can be discovered but has no enabled Folio generation operation yet.
DeepSeek is not implemented by the supplied package. General bitmap generation
or photo editing is not provided by this SVG adapter.

If Codex is older or managed configuration conflicts with Folio's restrictions,
the UI explains the unsupported setup. Update the official CLI or resolve the
configuration conflict; the companion does not relax permissions to continue.
AI reconstruction is a candidate for review and is not guaranteed pixel-perfect.

The strict configuration and configuration-read protocol were checked with the
official Codex CLI **0.166.0** using an isolated empty account configuration.
This checks CLI compatibility, not a signed-in account or successful generation.
Required managed hooks correctly prevent this fixed-purpose operation from
starting. Later CLI changes may require a companion update.

## Privacy, persistence and testing

The companion does not store provider credentials, prompts, source images or AI
results after a job. Codex owns sign-in and account usage policies. Files are
deleted only after the subprocess exits. Results are saved in Folio only when you
choose Save. Other imported files are not uploaded by this workflow.

Folio's email/password account, private Site hosting access and this computer's
Codex sign-in are separate identities. Folio Profile and password controls update
the Folio account; they do not change hosting permissions or the Codex account.

Automated tests exercise the process and HTTP behavior using deterministic local
CLI fixtures. They are not a successful test of your real OpenAI account. Complete
the explicit connection and attached-image tests on your own computer.

This companion includes adapted `@codraoss/ai-cli-integration` 0.1.0 code supplied
by the project owner under AGPL-3.0-only; see the bundled license and the source
repository's `vendor/ai-cli-integration/FOLIO-CHANGES.md`.
