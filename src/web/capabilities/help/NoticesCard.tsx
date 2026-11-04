import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { RecentImportsResponse } from '../../../contracts/sources.js';
import {
  Button,
  buttonClass,
  Card,
  MutedText,
  Row,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { useSession } from '../identity/session.js';
import { fetchDue } from '../study/api.js';
import { fetchBanks } from '../library/api.js';

const SEEN_KEY = 'qbank.notices.seen';
const PERIOD_MS = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000 } as const;

/** How an ended import is announced: never success when it was partial (FR-22-003). */
function importText(stage: string): MessageKey {
  if (stage === 'needs_review') return 'notice.import.review';
  if (stage === 'partial_failure') return 'notice.import.partial';
  return stage === 'failed' ? 'notice.import.failed' : 'notice.import.done';
}

/** Due reviews, only when the owner turned reminders on, at most once per period (FR-22-004). */
function useDueReminder() {
  const { state } = useSession();
  const reminders =
    state.status === 'signed-in' ? state.account.preferences.reviewReminders : 'off';
  const load = useCallback(async () => {
    if (reminders === 'off') return 0;
    const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    if (Date.now() - seen < PERIOD_MS[reminders]) return 0;
    const banks = (await fetchBanks()).banks.map((b) => b.id);
    return banks.length === 0 ? 0 : (await fetchDue(banks)).count;
  }, [reminders]);
  return useQuery(load).state;
}

/** Imports that ended lately and, if wanted, today's due reviews (M14.4); quiet otherwise. */
export function NoticesCard() {
  const { t } = useI18n();
  const imports = useQuery(
    useCallback(() => apiRequest('GET', '/api/imports/recent', RecentImportsResponse), []),
  ).state;
  const due = useDueReminder();
  const [hidden, setHidden] = useState(false);
  const recent = imports.status === 'ready' ? imports.data.imports.slice(0, 3) : [];
  const dueCount = due.status === 'ready' ? due.data : 0;
  if (hidden || (recent.length === 0 && dueCount === 0)) return null;
  const hide = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    setHidden(true);
  };
  return (
    <Card>
      <Stack>
        <Subtitle>{t('notice.title')}</Subtitle>
        {recent.map((i) => (
          <Row key={i.id}>
            <MutedText>
              {t(importText(i.stage))} <bdi>{i.fileName}</bdi> ({i.questionsFound} · {i.needsReview}
              )
            </MutedText>
            <Link to={`/imports/${i.id}`}>{t('notice.import.open')}</Link>
          </Row>
        ))}
        {dueCount > 0 && (
          <Row>
            <MutedText>
              {t('notice.due')} {dueCount}
            </MutedText>
            <Link className={buttonClass('secondary')} to="/study/plan">
              {t('notice.due.go')}
            </Link>
          </Row>
        )}
        <Button variant="ghost" onClick={hide}>
          {t('notice.dismiss')}
        </Button>
      </Stack>
    </Card>
  );
}
