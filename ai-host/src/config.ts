/** What the AI host needs from its launcher (QBank's server or a systemd unit). */
export interface HostConfig {
  /** Loopback port QBank's server calls. */
  readonly port: number;
  /** Shared secret every request must carry; the port is never reachable without it. */
  readonly token: string;
  /** The kit's home: settings.json, secrets, caches, logs and its sqlite file. */
  readonly home: string;
  /** Working directory providers run in. */
  readonly cwd: string;
}

const MIN_TOKEN_LENGTH = 32;

/** Reads and checks the launch settings; refuses to start without a strong token. */
export function readConfig(env: NodeJS.ProcessEnv): HostConfig {
  const token = env['AI_HOST_TOKEN'] ?? '';
  const home = env['AI_HOST_HOME'] ?? '';
  if (token.length < MIN_TOKEN_LENGTH)
    throw new Error('AI_HOST_TOKEN must be at least 32 characters');
  if (!home) throw new Error('AI_HOST_HOME is required');
  const port = Number(env['AI_HOST_PORT'] ?? 3790);
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error('AI_HOST_PORT is invalid');
  return { port, token, home, cwd: env['AI_HOST_CWD'] ?? home };
}
