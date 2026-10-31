import { isAbsolute } from 'node:path';
import { cliReasoningEfforts, type CliEngine, type CliReasoningEffort } from '../contracts';

export interface StructuredCliSpawnInput {
  engine: CliEngine; executable: string; model: string; reasoning: CliReasoningEffort;
  prompt: string; cwd: string; schemaPath: string; outputPath: string; schema: unknown;
  imagePaths?: readonly string[];
  configOverrides: readonly string[];
}
export interface CliSpawnSpec { executable: string; args: string[]; stdin: string }
export function buildStructuredCliSpawnSpec(input: StructuredCliSpawnInput): CliSpawnSpec {
  if (input.engine !== 'codex') throw new Error('Grok execution is unavailable until its image and tool isolation are verified.');
  if (!isAbsolute(input.executable) || !/^[a-zA-Z0-9][a-zA-Z0-9._:/+-]{0,127}$/.test(input.model))
    throw new Error('Invalid CLI executable or model.');
  if (!cliReasoningEfforts.includes(input.reasoning) || !input.prompt.trim() || Buffer.byteLength(input.prompt) > 3 * 1024 * 1024)
    throw new Error('Invalid CLI reasoning or prompt.');
  if (![input.cwd, input.schemaPath, input.outputPath, ...(input.imagePaths ?? [])].every(isAbsolute))
    throw new Error('CLI paths must be absolute.');
  if (input.configOverrides.length === 0 || input.configOverrides.some((value) => value.includes('\0') || Buffer.byteLength(value) > 100_000))
    throw new Error('Validated CLI isolation overrides are required.');
  return {
    executable: input.executable,
    args: [
      'exec', '--strict-config', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--json',
      '-C', input.cwd, '--model', input.model,
      ...input.configOverrides.flatMap((value) => ['-c', value]),
      '-c', `model_reasoning_effort=${JSON.stringify(input.reasoning)}`,
      '--output-schema', input.schemaPath, '--output-last-message', input.outputPath,
      ...(input.imagePaths ?? []).flatMap((path) => ['--image', path]), '-',
    ],
    stdin: input.prompt,
  };
}
