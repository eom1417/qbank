/** Where feedback goes on a local install: the project's GitHub issues (a fork changes this). */
const NEW_ISSUE = 'https://github.com/eom1417/qbank/issues/new';
export const KINDS = ['problem', 'reading', 'idea'] as const;
export type Kind = (typeof KINDS)[number];

/** The issue as the owner will see it before sending: their words, then the report (no content). */
export function feedbackUrl(kind: Kind, tried: string, happened: string, report: unknown) {
  const title = `[${kind}] ${tried.trim().split('\n')[0]?.slice(0, 80) ?? ''}`;
  const parts = [`**What I tried / ماذا حاولت**\n${tried.trim()}`];
  if (happened.trim()) parts.push(`**What happened / ماذا حدث**\n${happened.trim()}`);
  if (report)
    parts.push(
      `**System report (counts and versions only)**\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
    );
  const query = new URLSearchParams({ title, body: parts.join('\n\n') });
  return `${NEW_ISSUE}?${query.toString()}`;
}

/** The note the server's operator reads (M31): the kind, then the user's own two answers. */
export function feedbackMessage(kind: Kind, tried: string, happened: string): string {
  const parts = [`[${kind}] ${tried.trim()}`];
  if (happened.trim()) parts.push(happened.trim());
  return parts.join('\n\n');
}
