import {
  cliEngines,
  parseCodexModels,
  parseGrokModels,
  type CliCatalog,
  type CliEngine,
  type CliEngineCatalog,
} from '../index';
import { resolveCliExecutable, type CliExecutableOptions } from './executables';
import { runCliProcess, safeCliEnvironment } from './process';

async function inspectEngine(
  engine: CliEngine,
  options: CliExecutableOptions,
): Promise<CliEngineCatalog> {
  const executable = await resolveCliExecutable(engine, options);
  if (!executable) {
    return { available: false, executable: null, version: null, models: [], error: 'CLI executable was not found.' };
  }
  const env = safeCliEnvironment(options.env);
  try {
    const [versionResult, modelResult] = await Promise.all([
      runCliProcess(executable, ['--version'], { env }),
      runCliProcess(executable, engine === 'codex' ? ['debug', 'models'] : ['models'], {
        env,
        timeoutMs: 45_000,
      }),
    ]);
    const models = engine === 'codex'
      ? parseCodexModels(modelResult.stdout)
      : parseGrokModels(modelResult.stdout);
    if (models.length === 0) {
      return {
        available: false,
        executable,
        version: versionResult.stdout.trim() || null,
        models,
        error: 'The CLI returned no available models. Confirm that it is signed in.',
      };
    }
    return {
      available: true,
      executable,
      version: versionResult.stdout.trim() || null,
      models,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      executable,
      version: null,
      models: [],
      error: error instanceof Error ? error.message : 'CLI inspection failed.',
    };
  }
}

export async function inspectCliCatalog(options: CliExecutableOptions = {}): Promise<CliCatalog> {
  const entries = await Promise.all(
    cliEngines.map(async (engine) => [engine, await inspectEngine(engine, options)] as const),
  );
  return {
    generatedAt: new Date().toISOString(),
    engines: Object.fromEntries(entries) as CliCatalog['engines'],
  };
}
