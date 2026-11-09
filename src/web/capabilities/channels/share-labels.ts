import type { ShareKind, ShareView } from '../../../contracts/sharing.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';

/** The one picture of each kind of share, next to its name everywhere. */
export const KIND_ICON: Record<ShareKind, string> = {
  agent: '🔌',
  exam: '🎓',
  practice: '📝',
};

/** What a share's lifecycle allows now (question 6); the server refuses anything else too. */
export function allowedControls(status: ShareView['status']) {
  const live = status === 'active' || status === 'scheduled';
  return {
    pause: live,
    resume: status === 'paused',
    end: live || status === 'paused',
    renew: status !== 'ended' && status !== 'archived',
    archive: status === 'ended',
  };
}

/** "Batches sent" for an agent, "attempts" for people. */
export const usesLabel = (kind: ShareKind): MessageKey =>
  kind === 'agent' ? 'sharing.uses.agent' : 'sharing.uses.people';
