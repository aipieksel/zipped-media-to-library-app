import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseCodexModels, parseGrokModels } from '../vendor/ai-cli-integration/src/catalog';
import { resolveCliExecutable, type CliExecutableOptions } from '../vendor/ai-cli-integration/src/node/executables';
import { runCliProcess, type CliProcessResult } from '../vendor/ai-cli-integration/src/node/process';
import { executeStructuredCli } from '../vendor/ai-cli-integration/src/node/execute';
import { inspectPng } from '../src/png-svg';
import { sanitizeSvg } from '../src/saved-svg';
import {
  AI_LIMITS, AI_PROTOCOL_VERSION, AI_SVG_OUTPUT_SCHEMA, aiModelSchema, aiSvgAnswerSchema,
  type AiCompanionStatus, type AiModel, type AiProviderStatus, type AiSelection,
  type AiSvgRequest, type AiSvgResult, type AiTestResult,
} from '../src/ai/contracts';
import { buildSvgPrompt } from '../src/ai/prompts';
import { CompanionError, publicError } from './errors';
import { fixedCodexOverrides, overrideArgs, parseMcpNames, readCodexConfiguration, validateCodexConfiguration } from './isolation';

export interface AiDriver {
  status(signal?: AbortSignal): Promise<AiCompanionStatus>;
  generate(request: AiSvgRequest, signal: AbortSignal): Promise<AiSvgResult>;
  test(request: AiSelection & {requestId: string}, signal: AbortSignal): Promise<AiTestResult>;
}
interface Inspection {
  executable: string; version: string; auth: AiProviderStatus['auth'];
}
interface Prepared extends Inspection { overrides: string[]; models: AiModel[] }

function versionFrom(result: CliProcessResult): string {
  return `${result.stdout}\n${result.stderr}`.match(/\b\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?\b/)?.[0] ?? 'unknown';
}
export function parseCodexAuthStatus(result: CliProcessResult): AiProviderStatus['auth'] {
  const status = `${result.stdout}\n${result.stderr}`;
  if (/not logged in|not signed in/i.test(status)) return 'not-signed-in';
  if (/logged in using (?:an? )?api key|api.key authentication/i.test(status)) return 'api-key';
  return /logged in using ChatGPT\b/i.test(status) ? 'chatgpt' : 'unknown';
}
export function requireCodexHelp(execHelp: string, serverHelp: string): void {
  const needed = ['--ignore-user-config', '--strict-config', '--ephemeral', '--image', '--output-schema', '--output-last-message', '--json'];
  if (needed.some((flag) => !execHelp.includes(flag)) || !serverHelp.includes('--listen') || !serverHelp.includes('--strict-config'))
    throw new CompanionError('ISOLATION_UNSUPPORTED', 'This Codex version lacks the required isolated SVG features. Update the official Codex CLI and reconnect.', 422);
}
async function withJob<T>(operation: (cwd: string, profile: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), 'folio-ai-'));
  try { return await operation(cwd, `folio_svg_${randomUUID().replaceAll('-', '')}`); }
  finally { await rm(cwd, { recursive: true, force: true }); }
}

/** Credentials stay with the installed CLI; only a positive ChatGPT status is accepted. */
export class CodexDriver implements AiDriver {
  constructor(private readonly options: CliExecutableOptions = {}) {}
  private async inspect(cwd: string, signal?: AbortSignal): Promise<Inspection> {
    const executable = await resolveCliExecutable('codex', this.options);
    if (!executable) throw new CompanionError('PROVIDER_UNAVAILABLE', 'Install the official Codex CLI on this computer, run codex login, and choose ChatGPT. Then reconnect.', 503);
    const run = (args: string[]) => runCliProcess(executable, args, { cwd, env: this.options.env, signal, timeoutMs: 15_000, maxOutputBytes: 512 * 1024 });
    const inspections = await Promise.allSettled([
      run(['--version']), run(['exec', '--help']), run(['app-server', '--help']),
      run(['login', 'status']),
    ]);
    if (signal?.aborted) throw new CompanionError('CANCELLED', 'The AI request was cancelled.', 409);
    // Wait for all probes to close before the enclosing isolated folder is removed.
    const failure = inspections.slice(0, 3).find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const [version, execHelp, serverHelp, authResult] = inspections.map((result) => result.status === 'fulfilled' ? result.value : null);
    if (!version || !execHelp || !serverHelp) throw new CompanionError('ISOLATION_UNSUPPORTED', 'Codex feature checks could not complete. Update Codex and reconnect.', 422);
    const auth = authResult ? parseCodexAuthStatus(authResult) : 'not-signed-in';
    if (auth !== 'chatgpt') throw new CompanionError(auth === 'api-key' ? 'CHATGPT_REQUIRED' : 'NOT_SIGNED_IN',
      auth === 'api-key' ? 'Codex is using an API key. Run codex login and choose your ChatGPT account; Folio does not fall back to API billing.'
        : 'Sign in to the official Codex CLI with codex login and choose ChatGPT, then reconnect.', 412);
    requireCodexHelp(`${execHelp.stdout}\n${execHelp.stderr}`, `${serverHelp.stdout}\n${serverHelp.stderr}`);
    return { executable, version: versionFrom(version), auth };
  }
  private async prepare(cwd: string, profile: string, signal?: AbortSignal, selection?: AiSelection): Promise<Prepared> {
    const info = await this.inspect(cwd, signal);
    const initialOverrides = fixedCodexOverrides(cwd, [], profile);
    const listed = await runCliProcess(info.executable, [...overrideArgs(initialOverrides), 'mcp', 'list', '--json'], {
      cwd, env: this.options.env, signal, timeoutMs: 20_000, maxOutputBytes: 2 * 1024 * 1024,
    });
    const names = parseMcpNames(listed.stdout);
    const overrides = fixedCodexOverrides(cwd, names, profile);
    if (selection) overrides.push(`model=${JSON.stringify(selection.model)}`, `model_reasoning_effort=${JSON.stringify(selection.reasoning)}`);
    const snapshot = await readCodexConfiguration(info.executable, cwd, overrides, { env: this.options.env, signal });
    validateCodexConfiguration(snapshot, cwd, profile);
    const discovered = await runCliProcess(info.executable, [...overrideArgs(overrides), 'debug', 'models'], {
      cwd, env: this.options.env, signal, timeoutMs: 45_000, maxOutputBytes: 4 * 1024 * 1024,
    });
    let models: AiModel[];
    try { models = parseCodexModels(discovered.stdout).map((item) => aiModelSchema.parse(item)); }
    catch { throw new CompanionError('MODEL_UNAVAILABLE', 'Codex returned an unsupported model catalog. Update Codex and reconnect.', 422); }
    if (!models.length) throw new CompanionError('MODEL_UNAVAILABLE', 'Codex returned no available models. Check your ChatGPT sign-in in Codex, then reconnect.', 422);
    if (selection) {
      if (selection.provider !== 'codex') throw new CompanionError('PROVIDER_UNAVAILABLE', 'This provider does not support Folio SVG requests yet.', 422);
      const chosen = models.find((model) => model.id === selection.model);
      if (!chosen || !chosen.reasoning.some((option) => option.id === selection.reasoning))
        throw new CompanionError('MODEL_UNAVAILABLE', 'The selected model or reasoning level is no longer available. Reconnect and choose from the current catalog.', 422);
    }
    return { ...info, overrides, models };
  }
  async status(signal?: AbortSignal): Promise<AiCompanionStatus> {
    const codex: AiProviderStatus = { id: 'codex', name: 'OpenAI · Codex', installed: false, version: null, auth: 'not-checked', ready: false, reason: null, models: [], capabilities: [] };
    const grok: AiProviderStatus = { id: 'grok', name: 'Grok', installed: false, version: null, auth: 'not-checked', ready: false, reason: 'SVG requests are not enabled: Grok image input and tool isolation still need verification.', models: [], capabilities: [] };
    const inspections = await Promise.allSettled([
      (async () => {
        codex.installed = Boolean(await resolveCliExecutable('codex', this.options));
        try {
          const prepared = await withJob((cwd, profile) => this.prepare(cwd, profile, signal));
          Object.assign(codex, { version: prepared.version, auth: prepared.auth, ready: true, models: prepared.models, capabilities: ['recreate-svg', 'clean-svg'] });
        } catch (error) {
          const safe = publicError(error);
          codex.auth = safe.code === 'CHATGPT_REQUIRED' ? 'api-key' : safe.code === 'NOT_SIGNED_IN' ? 'not-signed-in' : 'unknown';
          codex.reason = safe.message;
        }
      })(),
      (async () => {
        const executable = await resolveCliExecutable('grok', this.options);
        if (!executable) return;
        grok.installed = true;
        try {
          const results = await Promise.allSettled([
            runCliProcess(executable, ['--version'], { env: this.options.env, signal, timeoutMs: 10_000, maxOutputBytes: 64 * 1024 }),
            runCliProcess(executable, ['models'], { env: this.options.env, signal, timeoutMs: 15_000, maxOutputBytes: 512 * 1024 }),
          ]);
          if (results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled') return;
          grok.version = versionFrom(results[0].value);
          grok.models = parseGrokModels(results[1].value.stdout).map((model) => aiModelSchema.parse(model));
        } catch { /* Discovery does not establish execution readiness. */ }
      })(),
    ]);
    inspections.forEach((result, index) => { if (result.status === 'rejected') [codex, grok][index].reason = publicError(result.reason).message; });
    if (signal?.aborted) throw new CompanionError('CANCELLED', 'Connection check cancelled.', 409);
    return { protocolVersion: AI_PROTOCOL_VERSION, companionVersion: '1.0.0', activeRequestId: null, providers: [codex, grok], checkedAt: new Date().toISOString() };
  }
  async generate(request: AiSvgRequest, signal: AbortSignal): Promise<AiSvgResult> {
    if (request.provider !== 'codex') throw new CompanionError('PROVIDER_UNAVAILABLE', 'This provider does not support Folio SVG requests yet.', 422);
    const image = Buffer.from(request.image.dataBase64, 'base64');
    if (image.byteLength > AI_LIMITS.imageBytes) throw new CompanionError('PAYLOAD_TOO_LARGE', 'The PNG attachment exceeds 8 MiB.', 413);
    let metadata;
    try { metadata = inspectPng(image); }
    catch { throw new CompanionError('INVALID_REQUEST', 'The image attachment must be a valid, static PNG within the supported dimensions.'); }
    if (metadata.width !== request.image.width || metadata.height !== request.image.height)
      throw new CompanionError('INVALID_REQUEST', 'The attachment dimensions do not match the request.');
    return withJob(async (cwd, profile) => {
      const prepared = await this.prepare(cwd, profile, signal, request);
      if (!prepared.models.find((model) => model.id === request.model)?.supportsImages)
        throw new CompanionError('MODEL_UNAVAILABLE', 'Choose a model that accepts image attachments.', 422);
      const imagePath = join(cwd, 'source.png');
      await writeFile(imagePath, image, { mode: 0o600 });
      const result = await executeStructuredCli({
        ...this.options, executables: { codex: prepared.executable }, engine: 'codex',
        model: request.model, reasoning: request.reasoning, cwd,
        prompt: buildSvgPrompt(request), imagePaths: [imagePath], configOverrides: prepared.overrides,
        schema: AI_SVG_OUTPUT_SCHEMA, signal, timeoutMs: AI_LIMITS.timeoutMs,
        maxAnswerBytes: AI_LIMITS.svgBytes * 3 + 64 * 1024,
        validate(value) {
          try {
            const answer = aiSvgAnswerSchema.parse(value);
            const validated = sanitizeSvg(answer.svg, { width: request.image.width, height: request.image.height, profile: 'ai' });
            return { svg: validated.svg, summary: answer.summary };
          } catch { throw new CompanionError('INVALID_OUTPUT', 'The AI returned SVG that could not be validated safely. Try Recreate or simplify the request.', 502); }
        },
      });
      return { ...result.value, requestId: request.requestId, provider: 'codex', model: request.model, createdAt: new Date().toISOString() };
    });
  }
  async test(request: AiSelection & {requestId: string}, signal: AbortSignal): Promise<AiTestResult> {
    if (request.provider !== 'codex') throw new CompanionError('PROVIDER_UNAVAILABLE', 'This provider is not enabled for Folio AI requests.', 422);
    return withJob(async (cwd, profile) => {
      const prepared = await this.prepare(cwd, profile, signal, request);
      await executeStructuredCli({
        ...this.options, executables: { codex: prepared.executable }, engine: 'codex',
        model: request.model, reasoning: request.reasoning, cwd, configOverrides: prepared.overrides,
        prompt: 'This is a Folio connection test. Do not use tools, commands, files or web access. Return exactly the JSON object {"ok":true}.',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
        validate: (value) => z.strictObject({ ok: z.literal(true) }).parse(value),
        signal, timeoutMs: 60_000, maxAnswerBytes: 4096,
      });
      return { requestId: request.requestId, ok: true, provider: 'codex', model: request.model,
        message: 'ChatGPT text connection verified. Image-to-SVG results are checked separately when you generate.', checkedAt: new Date().toISOString() };
    });
  }
}
