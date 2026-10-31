import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export class CliProcessError extends Error {
  constructor(public readonly code: 'cancelled' | 'timeout' | 'output-limit' | 'failed' | 'unsafe-tool', message: string) {
    super(message); this.name = 'CliProcessError';
  }
}
export interface CliProcessOptions {
  cwd?: string;
  env?: Readonly<Record<string, string | undefined>>;
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
  signal?: AbortSignal;
  killGraceMs?: number;
  onSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  onStdoutLine?: (line: string) => void;
}
export interface CliProcessResult { stdout: string; stderr: string }

export function safeCliEnvironment(source: Readonly<Record<string, string | undefined>> = process.env): Record<string, string> {
  const allowed = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL',
    'CODEX_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'GROK_HOME', 'SYSTEMROOT', 'WINDIR', 'LOCALAPPDATA', 'APPDATA'];
  return Object.fromEntries(allowed.flatMap((key) => source[key] === undefined ? [] : [[key, source[key]!]]));
}

/** No shell; aborts settle only after the child closes, including a hard-kill fallback. */
export function runCliProcess(executable: string, args: readonly string[], options: CliProcessOptions = {}): Promise<CliProcessResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(new CliProcessError('cancelled', 'CLI request cancelled.')); return; }
    const grouped = process.platform !== 'win32';
    const child = spawn(executable, [...args], {
      cwd: options.cwd, env: safeCliEnvironment(options.env), shell: false,
      detached: grouped, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    let stdout = '', stderr = '', pendingLine = '', outputBytes = 0;
    const stdoutDecoder = new StringDecoder('utf8'), stderrDecoder = new StringDecoder('utf8');
    let settled = false, stopping: Error | undefined;
    let hardKill: ReturnType<typeof setTimeout> | undefined;
    let lastResort: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      try { if (grouped && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
      catch { try { child.kill(signal); } catch { /* process already exited */ } }
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); clearTimeout(hardKill); clearTimeout(lastResort);
      options.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve({ stdout, stderr });
    };
    const stop = (error: Error) => {
      if (stopping || settled) return;
      stopping = error;
      child.stdin.destroy();
      kill('SIGTERM');
      hardKill = setTimeout(() => {
        kill('SIGKILL');
        // OS process death closes pipes normally; also destroy inherited pipes
        // to avoid a descendant retaining them indefinitely after group kill.
        lastResort = setTimeout(() => {
          child.stdout.destroy(); child.stderr.destroy();
          if (child.exitCode !== null || child.signalCode !== null) finish(stopping);
        }, 1000);
      }, options.killGraceMs ?? 750);
    };
    const abort = () => stop(new CliProcessError('cancelled', 'CLI request cancelled.'));
    const timeout = setTimeout(() => stop(new CliProcessError('timeout', 'CLI request timed out.')), options.timeoutMs ?? 30_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    const append = (which: 'stdout' | 'stderr', chunk: Buffer) => {
      if (stopping) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > (options.maxOutputBytes ?? 4 * 1024 * 1024)) {
        stop(new CliProcessError('output-limit', 'CLI output exceeded its size limit.')); return;
      }
      const text = which === 'stdout' ? stdoutDecoder.write(chunk) : stderrDecoder.write(chunk);
      if (which === 'stderr') { stderr += text; return; }
      stdout += text;
      if (options.onStdoutLine) {
        pendingLine += text;
        let end: number;
        while ((end = pendingLine.indexOf('\n')) >= 0) {
          const line = pendingLine.slice(0, end); pendingLine = pendingLine.slice(end + 1);
          try { options.onStdoutLine(line); }
          catch (error) { stop(error instanceof Error ? error : new CliProcessError('failed', 'Invalid CLI event.')); return; }
        }
      }
    };
    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk));
    child.stdin.on('error', () => { /* exit status gives the useful failure */ });
    child.on('error', () => finish(new CliProcessError('failed', 'The CLI process could not start.')));
    child.on('close', (code) => {
      if (stopping) { finish(stopping); return; }
      if (pendingLine && options.onStdoutLine) {
        try { options.onStdoutLine(pendingLine); }
        catch (error) { finish(error instanceof Error ? error : new CliProcessError('failed', 'Invalid CLI event.')); return; }
      }
      if (code !== 0) finish(new CliProcessError('failed', 'The CLI request failed. Check the local CLI account and model, then try again.'));
      else finish();
    });
    try {
      options.onSpawn?.(child);
      if (options.stdin !== undefined) child.stdin.end(options.stdin);
      else if (!options.onSpawn) child.stdin.end();
    } catch (error) { stop(error instanceof Error ? error : new CliProcessError('failed', 'The CLI process could not start.')); }
  });
}
