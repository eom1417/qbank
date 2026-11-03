import { spawn, type ChildProcess } from 'node:child_process';

export interface CliCommand {
  bin: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Starts a CLI without a shell, in its own process group: the CLIs start helpers (Codex's
 * native binary, Claude under `script`) that must end with it. The caller owns its lifetime.
 */
export const startCli = (command: CliCommand): ChildProcess =>
  spawn(command.bin, [...command.args], {
    cwd: command.cwd,
    env: command.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });

/** Ends the CLI and everything it started (the whole process group). */
export function stopCli(child: ChildProcess) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

/** Runs a CLI to completion with `stdin`, a time limit, and its full output. */
export function runCli(command: CliCommand, stdin: string, timeoutMs: number): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = startCli(command);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopCli(child);
    }, timeoutMs);
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (error) => (stderr += error.message));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin?.end(stdin);
  });
}
