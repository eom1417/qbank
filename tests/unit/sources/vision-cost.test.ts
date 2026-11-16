import { describe, expect, it } from 'vitest';
import {
  AnthropicProvider,
  failureForStatus,
  interpret,
  outputSchema,
  replyText,
} from '../../../src/server/tools/vision-cost/anthropic-provider.js';
import {
  cliArgs,
  cliInput,
  cliSystem,
  interpretCli,
} from '../../../src/server/tools/vision-cost/claude-cli-provider.js';
import { findRegions, parseBboxPages, questionNumber } from '../../../src/server/tools/vision-cost/regions.js';
import { MarkReply, scoreReply } from '../../../src/server/tools/vision-cost/reply.js';
import { parseCredentials } from '../../../src/server/tools/vision-cost/run.js';
import { evenChunks } from '../../../src/server/tools/vision-cost/sheets.js';
import { fitLongEdge, imageTokens, layoutSheet } from '../../../src/server/tools/vision-cost/sheet-layout.js';
import { renderTable, summarize, type CallRecord } from '../../../src/server/tools/vision-cost/stats.js';

const line = (y: number, words: string[]): string =>
  `<line xMin="40" yMin="${y}" xMax="500" yMax="${y + 14}">` +
  words.map((w) => `<word xMin="1" yMin="${y}" xMax="2" yMax="${y + 14}">${w}</word>`).join('') +
  '</line>';

const BBOX =
  '<doc><page width="612.0" height="866.8"><flow><block>' +
  line(90, ['Q1)', 'A', 'boy']) + line(110, ['A.', 'Reassurance']) + line(400, ['Q2)', 'A', 'girl']) +
  '</block></flow></page><page width="612.0" height="866.8">' + line(60, ['Table']) + '</page></doc>';

describe('regions from the bbox text layer', () => {
  it('reads pages, lines and words', () => {
    const pages = parseBboxPages(BBOX);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.lines.map((l) => l.text)).toEqual(['Q1) A boy', 'A. Reassurance', 'Q2) A girl']);
  });

  it('runs each question to the next one, the last to the page bottom', () => {
    const [page] = parseBboxPages(BBOX);
    expect(page && findRegions(page)).toEqual([
      { page: 1, question: 1, top: 86, bottom: 396 },
      { page: 1, question: 2, top: 396, bottom: 866.8 },
    ]);
  });

  it('finds no region on a page without questions, and only line-leading Q<n>)', () => {
    const pages = parseBboxPages(BBOX);
    expect(pages[1] && findRegions(pages[1])).toEqual([]);
    expect(questionNumber('Q12) text')).toBe(12);
    expect(questionNumber('see Q12) above')).toBeNull();
    expect(questionNumber('Q12 text')).toBeNull();
  });
});

describe('contact-sheet layout', () => {
  const crop = { width: 1275, height: 400 };

  it('picks the grid nearest to square and fits the long edge', () => {
    const layout = layoutSheet(Array.from({ length: 9 }, () => crop), 1000, 1275);
    expect(layout.columns).toBe(2);
    expect(Math.max(layout.width, layout.height)).toBeLessThanOrEqual(1000);
    expect(layout.placements).toHaveLength(9);
    const [first, second] = layout.placements;
    expect(first && second && second.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
    expect(first && first.y).toBeGreaterThan(first?.labelY ?? 0);
  });

  it('never enlarges and rejects empty or oversized sheets', () => {
    const layout = layoutSheet([crop], 5000, 1275);
    expect(layout.width).toBe(1275);
    expect(() => layoutSheet([], 1000, 1275)).toThrow(RangeError);
    expect(() => layoutSheet(Array.from({ length: 11 }, () => crop), 1000, 1275)).toThrow(RangeError);
  });

  it('fits sizes, estimates image tokens and chunks evenly', () => {
    expect(fitLongEdge({ width: 1275, height: 1805 }, 700)).toEqual({ width: 494, height: 700 });
    expect(fitLongEdge({ width: 100, height: 50 }, 700)).toEqual({ width: 100, height: 50 });
    expect(imageTokens({ width: 750, height: 100 })).toBe(100);
    expect(evenChunks(Array.from({ length: 25 }, (_, i) => i), 10).map((c) => c.length)).toEqual([9, 8, 8]);
  });
});

describe('reply parsing and scoring', () => {
  const expected = [
    { item: 1, letter: 'A' as const },
    { item: 2, letter: null },
    { item: 3, letter: 'C' as const },
  ];

  it('scores matches, nulls and missing items', () => {
    const reply = MarkReply.parse({ answers: [{ item: 1, letter: 'A' }, { item: 2, letter: null }, { item: 1, letter: 'B' }] });
    expect(scoreReply(reply, expected)).toBe(2);
    expect(scoreReply(null, expected)).toBe(0);
  });

  it('accepts fenced JSON and rejects off-schema replies', () => {
    const ok = interpret(
      { content: [{ type: 'thinking' }, { type: 'text', text: '```json\n{"answers":[{"item":1,"letter":"D"}]}\n```' }], usage: { input_tokens: 900, output_tokens: 20 } },
      MarkReply,
    );
    expect(ok).toEqual({ ok: true, value: { answers: [{ item: 1, letter: 'D' }] }, usage: { inputTokens: 900, outputTokens: 20 } });
    expect(interpret({ content: [{ type: 'text', text: '{"answers":[{"item":1,"letter":"Z"}]}' }] }, MarkReply)).toEqual({ ok: false, failure: 'invalid_output' });
    expect(interpret({ content: [{ type: 'text', text: 'B' }] }, MarkReply)).toEqual({ ok: false, failure: 'invalid_output' });
    expect(interpret({ stop_reason: 'refusal', content: [] }, MarkReply)).toEqual({ ok: false, failure: 'unexpected' });
    expect(replyText({})).toBe('');
  });

  it('maps HTTP status to provider failures and exports a clean schema', () => {
    expect([401, 402, 403, 404, 429, 500].map(failureForStatus)).toEqual([
      'invalid_key', 'no_quota', 'no_permission', 'model_missing', 'rate_limited', 'unexpected',
    ]);
    const schema = outputSchema(MarkReply);
    expect(schema['$schema']).toBeUndefined();
    expect(schema['additionalProperties']).toBe(false);
  });
});

describe('anthropic provider over fetch', () => {
  const okBody = { content: [{ type: 'text', text: '{"answers":[]}' }], usage: { input_tokens: 5, output_tokens: 3 } };
  const request = { name: 'm', system: 's', parts: [{ type: 'text' as const, text: 'x' }], schema: MarkReply };

  it('falls back from a refused key to the bearer token', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push(headers['x-api-key'] ? 'key' : 'bearer');
      return headers['x-api-key']
        ? new Response('{}', { status: 401 })
        : new Response(JSON.stringify(okBody), { status: 200 });
    }) as typeof fetch;
    const provider = new AnthropicProvider({ model: 'm', credentials: { apiKey: 'k', authToken: 't' }, fetchImpl });
    expect(await provider.generate(request)).toEqual({ ok: true, value: { answers: [] }, usage: { inputTokens: 5, outputTokens: 3 } });
    expect(seen).toEqual(['key', 'bearer']);
  });

  it('fails closed without credentials or on a network error', async () => {
    const none = new AnthropicProvider({ model: 'm', credentials: {} });
    expect(await none.generate(request)).toEqual({ ok: false, failure: 'invalid_key' });
    const down = new AnthropicProvider({
      model: 'm',
      credentials: { apiKey: 'k' },
      fetchImpl: (() => Promise.reject(new Error('down'))) as typeof fetch,
    });
    expect(await down.generate(request)).toEqual({ ok: false, failure: 'unreachable' });
  });

  it('reads credentials from NAME=value lines, ignoring blanks', () => {
    expect(parseCredentials('ANTHROPIC_API_KEY=\nANTHROPIC_AUTH_TOKEN=tok\nOTHER=x\n')).toEqual({
      apiKey: undefined,
      authToken: 'tok',
      baseUrl: undefined,
    });
  });
});

describe('results table', () => {
  const record = (correct: number, failure: string | null): CallRecord => ({
    format: 'CROP', size: 700, model: 'h', questions: 1, correct, inputTokens: 500, cacheCreation: 300, cacheRead: 100, outputTokens: 30, seconds: 2, failure, estimated: false,
  });

  it('groups by format × size × model and reports per-question costs', () => {
    const rows = summarize([record(1, null), record(0, 'invalid_output')], { h: 200 });
    expect(rows).toEqual([
      { format: 'CROP', size: 700, model: 'h', correct: 1, total: 2, accuracy: 0.5, inputPerQuestion: 500, inputExclOverheadPerQuestion: 300, cacheCreationPerCall: 300, cacheReadPerCall: 100, outputPerQuestion: 30, secondsPerQuestion: 2, calls: 2, failures: 1, estimated: false },
    ]);
    expect(renderTable(rows)).toContain('| CROP | 700 | h | 1/2 | 500 | 300 | 300/100 | 30 | 2 | 2 | 1 |');
  });
});

describe('claude CLI transcript', () => {
  const result = (extra: Record<string, unknown>): string =>
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...extra });
  const usage = { input_tokens: 2, cache_creation_input_tokens: 600, cache_read_input_tokens: 1000, output_tokens: 9 };

  it('reads the final result with the full input split', () => {
    const stdout = ['{"type":"system","subtype":"init"}', 'not json', result({ result: '{"answers":[]}', usage }), ''].join('\n');
    expect(interpretCli(stdout, MarkReply)).toEqual({
      ok: true,
      value: { answers: [] },
      usage: { inputTokens: 1602, outputTokens: 9, uncachedInput: 2, cacheCreation: 600, cacheRead: 1000 },
    });
  });

  it('fails on no result, an error turn or off-schema text', () => {
    expect(interpretCli('{"type":"assistant"}', MarkReply)).toEqual({ ok: false, failure: 'unreachable' });
    expect(interpretCli(result({ subtype: 'error_during_execution', is_error: true }), MarkReply)).toEqual({ ok: false, failure: 'unexpected' });
    expect(interpretCli(result({ result: 'The answer is B' }), MarkReply)).toEqual({ ok: false, failure: 'invalid_output' });
  });

  it('builds a tool-less, session-less turn with images and the schema in the system prompt', () => {
    const request = {
      name: 'm',
      system: 'Read marks.',
      parts: [{ type: 'image' as const, mediaType: 'image/png' as const, base64: 'AAA' }, { type: 'text' as const, text: 'Q1' }],
      schema: MarkReply,
    };
    const args = cliArgs('claude-haiku-5-5', cliSystem(request), 'low');
    expect(args).toEqual(expect.arrayContaining(['--tools', '', '--no-session-persistence', '--model', 'claude-haiku-5-5']));
    expect(cliSystem(request)).toContain('"answers"');
    const message = JSON.parse(cliInput(request)) as { message: { content: { type: string }[] } };
    expect(message.message.content.map((c) => c.type)).toEqual(['image', 'text']);
  });
});
