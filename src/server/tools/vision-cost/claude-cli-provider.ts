import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseModelOutput,
  type AiFailure,
  type AiProvider,
  type StructuredRequest,
  type StructuredResult,
} from '../../capabilities/providers/domain/ai-provider.js';
import { outputSchema, stripFence } from './anthropic-provider.js';

/**
 * Bench `AiProvider` over the logged-in `claude` CLI (the subscription path): one print-mode turn
 * per request, stream-json in and out, no tools, no MCP, no settings, no session kept. The run
 * happens in an empty temp directory so no project instructions load.
 */
export interface CliOptions {
  model: string;
  effort?: 'low' | 'medium' | 'high';
  /** Program to run; default `claude`. */
  command?: string;
  timeoutMs?: number;
}

/** Input split as the CLI reports it; `inputTokens` is the sum of all three. */
interface CliUsage {
  inputTokens: number;
  outputTokens: number;
  uncachedInput: number;
  cacheCreation: number;
  cacheRead: number;
}

export type CliResult<T> =
  { ok: true; value: T; usage: CliUsage } | { ok: false; failure: AiFailure };

interface ResultEvent {
  type: 'result';
  subtype?: string;
  is_error?: boolean;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export function cliArgs(model: string, system: string, effort: string): string[] {
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    model,
    '--system-prompt',
    system,
    '--tools',
    '',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--disable-slash-commands',
    '--effort',
    effort,
  ];
}

/** The system prompt: the request's text plus the reply contract. */
export function cliSystem<T>(request: StructuredRequest<T>): string {
  const schema = JSON.stringify(outputSchema(request.schema));
  return `${request.system}\nReply with JSON only matching this schema: ${schema}`;
}

/** The single stream-json user message carrying the request's parts. */
export function cliInput<T>(request: StructuredRequest<T>): string {
  const content = request.parts.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : {
          type: 'image',
          source: { type: 'base64', media_type: part.mediaType, data: part.base64 },
        },
  );
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`;
}

/** The final `result` event of a stream-json transcript, or null. */
function resultEvent(stdout: string): ResultEvent | null {
  let found: ResultEvent | null = null;
  for (const line of stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const event = JSON.parse(line) as { type?: string };
      if (event.type === 'result') found = event as ResultEvent;
    } catch {
      continue;
    }
  }
  return found;
}

function cliUsage(event: ResultEvent): CliUsage {
  const u = event.usage ?? {};
  const uncachedInput = u.input_tokens ?? 0;
  const cacheCreation = u.cache_creation_input_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  return {
    inputTokens: uncachedInput + cacheCreation + cacheRead,
    outputTokens: u.output_tokens ?? 0,
    uncachedInput,
    cacheCreation,
    cacheRead,
  };
}

/** A transcript to a result: no result event, an error turn or off-schema text all fail. */
export function interpretCli<T>(
  stdout: string,
  schema: StructuredRequest<T>['schema'],
): CliResult<T> {
  const event = resultEvent(stdout);
  if (!event) return { ok: false, failure: 'unreachable' };
  if (event.is_error || event.subtype !== 'success') return { ok: false, failure: 'unexpected' };
  const value = parseModelOutput(stripFence(event.result ?? ''), schema);
  if (value === null) return { ok: false, failure: 'invalid_output' };
  return { ok: true, value, usage: cliUsage(event) };
}

function runCli(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const cwd = mkdtempSync(join(tmpdir(), 'vision-cost-cli-'));
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: timeoutMs,
    });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    const done = (value: string | null): void => {
      rmSync(cwd, { recursive: true, force: true });
      resolve(value);
    };
    child.on('error', () => done(null));
    child.on('close', () => done(stdout));
    child.stdin.end(input);
  });
}

export class ClaudeCliProvider implements AiProvider {
  readonly #options: CliOptions;

  constructor(options: CliOptions) {
    this.#options = options;
  }

  /** One CLI turn with the full cache split. */
  async generateDetailed<T>(request: StructuredRequest<T>): Promise<CliResult<T>> {
    const args = cliArgs(this.#options.model, cliSystem(request), this.#options.effort ?? 'low');
    const command = this.#options.command ?? 'claude';
    const stdout = await runCli(
      command,
      args,
      cliInput(request),
      this.#options.timeoutMs ?? 300_000,
    );
    if (stdout === null) return { ok: false, failure: 'unreachable' };
    return interpretCli(stdout, request.schema);
  }

  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const result = await this.generateDetailed(request);
    if (!result.ok) return result;
    const { inputTokens, outputTokens } = result.usage;
    return { ok: true, value: result.value, usage: { inputTokens, outputTokens } };
  }
}
