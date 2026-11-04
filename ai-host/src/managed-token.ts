import { connect } from 'node:net';

/** The subcommand Codex runs for an access token in managed ChatGPT mode (the kit's runtime). */
export const MANAGED_TOKEN_COMMAND = '__managed-chatgpt-token';

/** The kit's limits (CodexManagedTokenProtocol): a reply may wait on a refresh, never longer. */
const RESPONSE_BYTES = 64 * 1024;
const COMMAND_TIMEOUT_MS = 80_000;

function requestToken(endpoint: string, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(endpoint);
    let reply = '';
    socket.setTimeout(COMMAND_TIMEOUT_MS, () => socket.destroy(new Error('timed out')));
    socket.on('connect', () => socket.write(`${request}\n`));
    socket.on('data', (chunk) => {
      reply += chunk.toString('utf8');
      if (reply.length > RESPONSE_BYTES) socket.destroy(new Error('reply too large'));
    });
    socket.on('error', reject);
    socket.on('close', () =>
      reply.endsWith('\n') ? resolve(reply) : reject(new Error('no token')),
    );
  });
}

/**
 * Asks the kit's token broker (a private socket owned by this host) for a fresh access token and
 * prints only the token, as Codex expects. The refresh token never leaves the broker, so this
 * process can never race a token rotation. Returns the exit code.
 */
export async function printManagedToken(args: readonly string[]): Promise<number> {
  const [endpoint, instanceId, environmentId, profileKey] = args;
  if (!endpoint || !instanceId || !environmentId || !profileKey) return 2;
  const request = JSON.stringify({ version: 1, instanceId, environmentId, profileKey });
  try {
    const reply = JSON.parse(await requestToken(endpoint, request)) as { token?: unknown };
    if (typeof reply.token !== 'string' || reply.token === '') return 1;
    process.stdout.write(reply.token);
    return 0;
  } catch {
    process.stderr.write('Could not get a ChatGPT token from QBank. Sign in again in QBank.\n');
    return 1;
  }
}
