import { useCallback, useState } from 'react';
import type { MediaListResponse } from '../../../contracts/sources.js';
import { Badge, Button, Card, Grid, MutedText, Stack, Title } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchImportMedia, mediaSrc } from './api.js';
import { useMediaAlt } from './media-alt.js';
import { MediaViewer } from './MediaViewer.js';

type Media = MediaListResponse['media'][number];

function MediaTile({ media, onOpen }: { media: Media; onOpen(): void }) {
  const { t } = useI18n();
  const alt = useMediaAlt();
  return (
    <Stack>
      <Button variant="ghost" aria-label={`${t('media.open')}: ${alt(media)}`} onClick={onOpen}>
        <img className="qb-thumb" src={mediaSrc(media.id)} alt={alt(media)} loading="lazy" />
      </Button>
      <MutedText>
        {alt(media)} · {t('media.page')} {media.page}
      </MutedText>
      {media.link === 'uncertain' && <Badge>{t('media.uncertain')}</Badge>}
      {media.lowQuality && <Badge>{t('media.lowQuality')}</Badge>}
    </Stack>
  );
}

/** The pictures and tables an import kept, each with its question (UI-09, M5). */
export function MediaCard({ importId }: { importId: string }) {
  const { t } = useI18n();
  const load = useCallback(() => fetchImportMedia(importId), [importId]);
  const { state } = useQuery(load);
  const [open, setOpen] = useState<Media | null>(null);
  if (state.status !== 'ready' || state.data.media.length === 0) return null;
  return (
    <Card>
      <Title>{t('media.title')}</Title>
      <Grid>
        {state.data.media.map((media) => (
          <MediaTile key={media.id} media={media} onOpen={() => setOpen(media)} />
        ))}
      </Grid>
      <MediaViewer media={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
