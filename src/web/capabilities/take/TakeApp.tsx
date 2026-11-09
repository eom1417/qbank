import { useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router';
import type { TakeResultResponse, TakeStateResponse } from '../../../contracts/take.js';
import { Alert, Button, MutedText, NarrowColumn, PageShell } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { TakeExam } from './TakeExam.js';
import { TakeLanding } from './TakeLanding.js';
import { TakeResult } from './TakeResult.js';
import { useAttempt } from './use-attempt.js';
import { useTake } from './use-take.js';

/** A standalone page: no account, no app navigation, only the language switch. */
function TakeFrame({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <PageShell
      brand={<span>{t('app.name')}</span>}
      actions={
        <Button variant="ghost" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
          {t('shell.language')}
        </Button>
      }
    >
      <NarrowColumn>{children}</NarrowColumn>
    </PageShell>
  );
}

/** The attempt, until it ends; then its result replaces it. */
function AttemptView({
  token,
  first,
  onResult,
}: {
  token: string;
  first: TakeStateResponse;
  onResult(token: string, result: TakeResultResponse): void;
}) {
  const ended = useCallback(
    (result: TakeResultResponse) => onResult(token, result),
    [onResult, token],
  );
  return <TakeExam attempt={useAttempt(token, first, ended)} />;
}

/** What the link shows now: an error to retry, the rules, the attempt or the result. */
function TakeBody({ take }: { take: ReturnType<typeof useTake> }) {
  const { t } = useI18n();
  const { entry, error } = take;
  if (error)
    return (
      <>
        <Alert tone="error">{t(error)}</Alert>
        <Button variant="secondary" onClick={take.retry}>
          {t('take.retry')}
        </Button>
      </>
    );
  if (!entry) return <MutedText>{t('common.loading')}</MutedText>;
  if (entry.phase === 'landing')
    return <TakeLanding landing={entry.landing} onStart={take.start} />;
  if (entry.phase === 'result') return <TakeResult result={entry.result} />;
  return <AttemptView token={entry.token} first={entry.state} onResult={take.showResult} />;
}

/**
 * The page behind a shared exam or practice link, `/t/:token` (M30, DEC-39): anyone with the
 * link opens it with no account, sees the rules, and answers under the share's policy.
 */
export function TakeApp() {
  const link = useParams()['token'] ?? '';
  return (
    <TakeFrame>
      <TakeBody take={useTake(link)} />
    </TakeFrame>
  );
}
