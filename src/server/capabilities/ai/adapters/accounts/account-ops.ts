import type {
  AiFailure,
  AiProvider,
  ModelListing,
  StructuredRequest,
} from '../../domain/ai-provider.js';
import { structuredResult } from '../provider-call.js';
import {
  withAccountHome,
  type AccountHome,
  type AccountSpec,
  type HomeSettings,
} from './account-home.js';
import { runCli, type CliCommand } from './cli-process.js';

export interface Identity {
  email: string | null;
  plan: string | null;
}

export type CallOutcome =
  { ok: true; json: unknown } | { ok: false; failure: Exclude<AiFailure, 'invalid_output'> };

/** How the app signs in with one provider's official CLI and parses what it prints. */
interface LoginDefinition {
  command(home: AccountHome): CliCommand;
  urlPattern: RegExp;
  /** Codex shows a one-time code to enter on the provider's page; Claude does not. */
  codePattern: RegExp | null;
  /** Claude prints a code after approval that the user pastes back into the CLI. */
  needsCode: boolean;
}

/** Everything one subscription provider needs: credential files, identity, runs, login. */
export interface AccountOps {
  spec: AccountSpec;
  defaultModel: string;
  models: readonly string[];
  identify(home: AccountHome): Promise<Identity | null>;
  generate<T>(
    home: AccountHome,
    model: string,
    request: StructuredRequest<T>,
  ): Promise<CallOutcome>;
  login: LoginDefinition;
}

interface AccountTarget {
  ops: AccountOps;
  home: HomeSettings;
  /** The opened (decrypted) credential; never logged or returned. */
  credential: string;
  model: string;
  /** Saves a credential the CLI refreshed during the run, sealed again by the caller. */
  saveCredential(credential: string): Promise<void>;
  /** Serializes runs of one connection, so two refreshes never overwrite each other. */
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}

async function inHome<T>(
  target: AccountTarget,
  work: (home: AccountHome) => Promise<T>,
): Promise<T> {
  return target.exclusive(async () => {
    const run = await withAccountHome(target.home, target.ops.spec, target.credential, work);
    if (run.credential && run.credential !== target.credential) {
      target.credential = run.credential;
      await target.saveCredential(run.credential);
    }
    return run.value;
  });
}

/**
 * A subscription account as an AI provider: each call runs the provider's own CLI in a
 * private home holding only this account's login (the Remote pattern, per owner direction).
 */
export function createAccountProvider(target: AccountTarget): AiProvider {
  return {
    async listModels(): Promise<ModelListing> {
      const identity = await inHome(target, (home) => target.ops.identify(home));
      if (!identity) return { status: 'invalid_key', models: [] };
      return { status: 'ready', models: [...new Set([...target.ops.models, target.model])] };
    },
    async generate(request) {
      const outcome = await inHome(target, (home) =>
        target.ops.generate(home, target.model, request),
      );
      if (!outcome.ok) return outcome;
      const text = outcome.json === null ? null : JSON.stringify(outcome.json);
      return structuredResult(text, request.schema, null);
    },
  };
}

/** A provider's operations before its CLI path is known (`bin` comes from config). */
export interface AccountImpl {
  spec: AccountSpec;
  defaultModel: string;
  models: readonly string[];
  identify(bin: string, home: AccountHome): Promise<Identity | null>;
  generate<T>(
    bin: string,
    home: AccountHome,
    model: string,
    request: StructuredRequest<T>,
  ): Promise<CallOutcome>;
  login: Omit<LoginDefinition, 'command'> & { command(bin: string, home: AccountHome): CliCommand };
}

export const bindAccount = (impl: AccountImpl, bin: string): AccountOps => ({
  ...impl,
  identify: (home) => impl.identify(bin, home),
  generate: (home, model, request) => impl.generate(bin, home, model, request),
  login: { ...impl.login, command: (home) => impl.login.command(bin, home) },
});

const VALIDATE_TIMEOUT_MS = 30_000;
export const GENERATE_TIMEOUT_MS = 300_000;

/** Runs the CLI inside the private home with only the allowed environment. */
export const runInHome = (
  bin: string,
  home: AccountHome,
  args: readonly string[],
  stdin = '',
  timeoutMs = VALIDATE_TIMEOUT_MS,
) => runCli({ bin, args, env: home.env, cwd: home.root }, stdin, timeoutMs);
