import { describe, expect, it } from 'vitest';
import {
  feedbackMessage,
  feedbackUrl,
  KINDS,
} from '../../../src/web/capabilities/help/feedback-note.js';
import { ar } from '../../../src/web/platform/i18n/catalog-ar.js';
import { en } from '../../../src/web/platform/i18n/catalog-en.js';

const issue = (url: string) => {
  const parsed = new URL(url);
  return {
    base: `${parsed.origin}${parsed.pathname}`,
    title: parsed.searchParams.get('title') ?? '',
    body: parsed.searchParams.get('body') ?? '',
  };
};

describe('feedback as a prefilled GitHub issue (M28.2)', () => {
  it("carries the owner's words and the report, nothing else", () => {
    const report = { mode: 'local', banks: 2 };
    const { base, title, body } = issue(
      feedbackUrl('reading', 'Import my cardiology PDF\nmore', 'Read 3 of 40', report),
    );
    expect(base).toBe('https://github.com/eom1417/qbank/issues/new');
    expect(title).toBe('[reading] Import my cardiology PDF');
    expect(body).toContain('Read 3 of 40');
    expect(body).toContain('"banks": 2');
  });

  it('leaves the report out when the owner unticks it, and an empty field out', () => {
    const { body } = issue(feedbackUrl('idea', 'Dark mode on the phone', '   ', null));
    expect(body).not.toContain('System report');
    expect(body).not.toContain('What happened');
  });
});

describe("feedback to the server's operator (M31 B1, M32)", () => {
  it("carries the kind in the sender's words and both answers, trimmed", () => {
    expect(feedbackMessage(ar['feedback.kind.reading'], '  Import my PDF ', ' Read 3 of 40 ')).toBe(
      `[${ar['feedback.kind.reading']}] Import my PDF\n\nRead 3 of 40`,
    );
  });

  it('leaves an empty second answer out', () => {
    expect(feedbackMessage(en['feedback.kind.idea'], 'Dark mode on the phone', '   ')).toBe(
      `[${en['feedback.kind.idea']}] Dark mode on the phone`,
    );
  });

  it('names every kind in Arabic for an Arabic sender, never the English tag', () => {
    for (const kind of KINDS) {
      const label = ar[`feedback.kind.${kind}`];
      expect(label).not.toBe(kind);
      expect(feedbackMessage(label, 'x', '')).toBe(`[${label}] x`);
    }
  });
});
