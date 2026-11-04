import { MANAGED_TOKEN_COMMAND, printManagedToken } from './managed-token.ts';

/**
 * Entry point. Codex runs this same file as its token command in managed ChatGPT mode (the
 * kit's self-invocation); every other start boots the AI host.
 */
if (process.argv[2] === MANAGED_TOKEN_COMMAND) {
  process.exitCode = await printManagedToken(process.argv.slice(3));
} else {
  await import('./host.ts');
}
