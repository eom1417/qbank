import type { AccountProvider, ProviderKind } from '../../../../../contracts/ai.js';
import { bindAccount, type AccountOps } from './account-ops.js';
import { claudeAccount } from './claude-account.js';
import { codexAccount } from './codex-account.js';

export interface AccountCliSettings {
  claudeBin: string;
  codexBin: string;
  workDir: string;
  cliEnv: Record<string, string>;
}

export const accountProviderOf = (kind: ProviderKind): AccountProvider | null =>
  kind === 'claude_account' ? 'claude' : kind === 'codex_account' ? 'codex' : null;

export const accountKindOf = (provider: AccountProvider): ProviderKind =>
  provider === 'claude' ? 'claude_account' : 'codex_account';

export function opsFor(settings: AccountCliSettings, provider: AccountProvider): AccountOps {
  return provider === 'claude'
    ? bindAccount(claudeAccount, settings.claudeBin)
    : bindAccount(codexAccount, settings.codexBin);
}

export { clearAccountHomes } from './account-home.js';
export { createAccountProvider } from './account-ops.js';
export { createExclusive } from './exclusive.js';
export { createLoginManager, type CompletedLogin, type LoginManager } from './login-sessions.js';
