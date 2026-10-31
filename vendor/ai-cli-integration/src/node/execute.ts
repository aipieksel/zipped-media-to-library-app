import { constants } from 'node:fs';
import { mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CliEngine, CliReasoningEffort } from '../contracts';
import { resolveCliExecutable, type CliExecutableOptions } from './executables';
import { CliProcessError, runCliProcess, type CliProcessOptions } from './process';
import { buildStructuredCliSpawnSpec } from './spawn-spec';

export interface ExecuteStructuredCliInput<T> extends CliExecutableOptions {
  engine: CliEngine; model: string; reasoning: CliReasoningEffort; prompt: string;
  cwd: string; schema: unknown; configOverrides: readonly string[]; imagePaths?: readonly string[];
  validate: (value: unknown) => T;
  timeoutMs?: number; maxAnswerBytes?: number; signal?: AbortSignal; onSpawn?: CliProcessOptions['onSpawn'];
}
export interface ExecuteStructuredCliResult<T> { value: T; engine: CliEngine; model: string; reasoning: CliReasoningEffort }

/** Resolve common CLI envelopes without choosing an unrelated nested object. */
export function parseStructuredOutput(raw: string): unknown {
  let value: unknown = JSON.parse(raw.trim());
  for (let depth = 0; depth < 8; depth++) {
    if (typeof value === 'string') { value = JSON.parse(value); continue; }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a structured object.');
    const record = value as Record<string, unknown>;
    if (typeof record.svg === 'string' || typeof record.html === 'string' || record.ok !== undefined) return record;
    const key = ['result', 'output', 'response', 'message', 'text', 'data'].find((name) => record[name] !== undefined);
    if (!key) return record;
    value = record[key];
  }
  throw new Error('The structured response envelope is too deeply nested.');
}
export async function readBoundedAnswer(path: string, maximum: number): Promise<string> {
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > maximum) throw new CliProcessError('output-limit', 'The CLI answer exceeded its size limit.');
    const buffer = Buffer.alloc(maximum + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const part = await file.read(buffer, bytes, buffer.length - bytes, bytes);
      if (!part.bytesRead) break;
      bytes += part.bytesRead;
    }
    if (bytes > maximum) throw new CliProcessError('output-limit', 'The CLI answer exceeded its size limit.');
    return buffer.subarray(0, bytes).toString('utf8');
  } finally { await file.close(); }
}

export function createCodexEventGuard(): { line: (line: string) => void; assertComplete: () => void } {
  let completed = false;
  return {
    line(line) {
      if (!line.trim()) return;
      let event: Record<string, unknown>;
      try { event = JSON.parse(line); }
      catch { throw new CliProcessError('failed', 'Codex returned an invalid event.'); }
      if (event === null || typeof event !== 'object') throw new CliProcessError('failed', 'Codex returned an invalid event.');
      const type = event.type;
      if (type === 'error' || type === 'turn.failed' || type === 'turn.cancelled' || type === 'turn.interrupted')
        throw new CliProcessError('failed', 'Codex did not complete the request.');
      if (type === 'turn.completed') {
        if (event.error || (event.status != null && event.status !== 'completed')) throw new CliProcessError('failed', 'Codex did not complete the request.');
        completed = true; return;
      }
      if (type === 'thread.started' || type === 'turn.started') return;
      if (type === 'item.started' || type === 'item.updated' || type === 'item.completed') {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === 'agent_message' || item?.type === 'reasoning') return;
      }
      // Unknown future action items must not silently gain new local powers.
      throw new CliProcessError('unsafe-tool', 'Codex attempted an unexpected tool action.');
    },
    assertComplete() { if (!completed) throw new CliProcessError('failed', 'Codex ended without a completed turn.'); },
  };
}
export async function executeStructuredCli<T>(input: ExecuteStructuredCliInput<T>): Promise<ExecuteStructuredCliResult<T>> {
  if (!(await stat(input.cwd)).isDirectory()) throw new Error('CLI working directory is not a directory.');
  const executable = await resolveCliExecutable(input.engine, input);
  if (!executable) throw new Error('CLI executable was not found.');
  const scratch = await mkdtemp(join(input.cwd, 'answer-'));
  const schemaPath = join(scratch, 'schema.json'), outputPath = join(scratch, 'answer.json');
  try {
    await writeFile(schemaPath, JSON.stringify(input.schema), { mode: 0o600 });
    const spec = buildStructuredCliSpawnSpec({ ...input, executable, schemaPath, outputPath });
    const guard = createCodexEventGuard();
    await runCliProcess(spec.executable, spec.args, {
      cwd: input.cwd, env: input.env, stdin: spec.stdin, signal: input.signal,
      timeoutMs: input.timeoutMs ?? 300_000, maxOutputBytes: 8 * 1024 * 1024,
      onSpawn: input.onSpawn, onStdoutLine: guard.line,
    });
    guard.assertComplete();
    const raw = await readBoundedAnswer(outputPath, input.maxAnswerBytes ?? 6 * 1024 * 1024);
    return { value: input.validate(parseStructuredOutput(raw)), engine: input.engine, model: input.model, reasoning: input.reasoning };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
