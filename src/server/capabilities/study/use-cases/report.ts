import type { Rate } from '../../../../contracts/analytics.js';
import { accuracy, score } from '../domain/metrics.js';
import type { StudyDeps } from './deps.js';

const LABELS = {
  en: {
    title: 'QBank study report',
    period: 'Period',
    sessions: 'Sessions',
    date: 'Date',
    mode: 'Mode',
    score: 'Score (right of all questions)',
    accuracy: 'Accuracy (right of answered)',
    seconds: 'Seconds',
    none: 'No sessions in this period.',
    note: 'Personal copy. It contains no AI keys or sign-ins.',
    tutor: 'Tutor',
    exam: 'Exam',
  },
  ar: {
    title: 'تقرير المذاكرة من QBank',
    period: 'الفترة',
    sessions: 'الجلسات',
    date: 'التاريخ',
    mode: 'النمط',
    score: 'الدرجة (الصحيح من كل الأسئلة)',
    accuracy: 'الدقة (الصحيح من المُجاب)',
    seconds: 'الثواني',
    none: 'لا جلسات في هذه الفترة.',
    note: 'نسخة شخصية، ولا تحوي أي مفاتيح أو تسجيلات دخول AI.',
    tutor: 'Tutor',
    exam: 'امتحان',
  },
};

type Locale = keyof typeof LABELS;

/** Text placed in the document is always escaped: it may come from the owner's own files. */
const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const rateText = (rate: Rate) =>
  rate.percent === null ? '—' : `${rate.part} / ${rate.whole} (${rate.percent}%)`;

interface ReportRow {
  createdAt: Date;
  mode: 'tutor' | 'exam';
  score: Rate;
  accuracy: Rate;
  seconds: number;
}

function tableOf(rows: readonly ReportRow[], locale: Locale) {
  const l = LABELS[locale];
  if (rows.length === 0) return `<p>${escape(l.none)}</p>`;
  const head = [l.date, l.mode, l.score, l.accuracy, l.seconds]
    .map((h) => `<th>${escape(h)}</th>`)
    .join('');
  const body = rows
    .map((r) => {
      const cells = [
        r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        l[r.mode],
        rateText(r.score),
        rateText(r.accuracy),
        String(r.seconds),
      ];
      return `<tr>${cells.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A readable report of the owner's sessions in a period (FR-18-002, FR-16-011): one HTML file
 * for personal use (DEC-19 assumed), every rate with its formula, never a key or sign-in.
 */
export async function resultsReport(
  deps: StudyDeps,
  ownerId: string,
  filter: { bankId?: string | undefined; from: Date; to: Date; locale?: Locale },
) {
  const locale = filter.locale ?? 'ar';
  const l = LABELS[locale];
  const rows = (await deps.sessions.sessionHistory(ownerId))
    .filter((s) => s.created_at >= filter.from && s.created_at <= filter.to)
    .filter(
      (s) =>
        !filter.bankId ||
        ((s.scope as { bankIds?: string[] }).bankIds ?? []).includes(filter.bankId),
    )
    .map((s) => ({
      createdAt: s.created_at,
      mode: s.mode,
      score: score(Number(s.correct), Number(s.total)),
      accuracy: accuracy(Number(s.correct), Number(s.answered)),
      seconds: Number(s.seconds),
    }));
  const period = `${filter.from.toISOString().slice(0, 10)} — ${filter.to.toISOString().slice(0, 10)}`;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><title>${escape(l.title)}</title></head><body><h1>${escape(l.title)}</h1><p>${escape(l.period)}: ${escape(period)}</p><h2>${escape(l.sessions)}</h2>${tableOf(rows, locale)}<p>${escape(l.note)}</p></body></html>`;
}
