import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import type { CliEngine } from '../contracts';

export interface CliExecutableOptions {
  executables?: Partial<Record<CliEngine, string>>;
  env?: Readonly<Record<string, string | undefined>>;
}

async function executable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function fromPath(command: string, pathValue: string | undefined): Promise<string | null> {
  for (const directory of (pathValue ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, command);
    if (await executable(candidate)) return candidate;
  }
  return null;
}

export async function resolveCliExecutable(
  engine: CliEngine,
  options: CliExecutableOptions = {},
): Promise<string | null> {
  const env = options.env ?? process.env;
  const configured = options.executables?.[engine]
    ?? env[engine === 'codex' ? 'CODRA_CODEX_EXECUTABLE' : 'CODRA_GROK_EXECUTABLE'];
  if (configured) {
    if (!isAbsolute(configured)) return fromPath(configured, env.PATH);
    return await executable(configured) ? configured : null;
  }

  const command = engine;
  const discovered = await fromPath(command, env.PATH);
  if (discovered) return discovered;
  const fallback = engine === 'codex'
    ? join(homedir(), '.local', 'bin', 'codex')
    : join(homedir(), '.grok', 'bin', 'grok');
  return await executable(fallback) ? fallback : null;
}
