import { useState } from 'react';
import type { ShareSecretResponse, ShareView } from '../../../contracts/sharing.js';
import { Button, Row, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { ChannelStatsView } from './ChannelStatsView.js';
import { PolicyCard } from './PolicyCard.js';
import { ShareControls } from './ShareControls.js';
import { ShareResultsView } from './ShareResultsView.js';
import { ShareTimeline } from './ShareTimeline.js';

type View = 'rules' | 'timeline' | 'numbers';

interface Props {
  share: ShareView;
  onChanged(): void;
  onSecret(created: ShareSecretResponse): void;
}

function ViewBody({ view, share }: { view: View; share: ShareView }) {
  if (view === 'timeline') return <ShareTimeline id={share.id} />;
  if (view === 'rules')
    return <PolicyCard kind={share.kind} name={share.name} policy={share.policy} />;
  if (share.kind === 'agent') return <ChannelStatsView id={share.id} />;
  return <ShareResultsView id={share.id} />;
}

/** One share opened: its controls, then its rules, its record, and its numbers or results. */
export function ShareDetails({ share, onChanged, onSecret }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('rules');
  const views: { id: View; label: string }[] = [
    { id: 'rules', label: t('sharing.view.rules') },
    { id: 'timeline', label: t('sharing.view.timeline') },
    {
      id: 'numbers',
      label: t(share.kind === 'agent' ? 'sharing.view.stats' : 'sharing.view.results'),
    },
  ];
  return (
    <Stack>
      <ShareControls share={share} onChanged={onChanged} onSecret={onSecret} />
      <Row>
        {views.map((v) => (
          <Button
            key={v.id}
            variant={v.id === view ? 'secondary' : 'ghost'}
            aria-pressed={v.id === view}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </Row>
      <ViewBody view={view} share={share} />
    </Stack>
  );
}
