import {
  DEFAULT_POLICIES,
  SharePolicy as SharePolicySchema,
  policyIssues,
  type ShareKind,
  type SharePolicy,
} from '../../../contracts/sharing.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';

type PresetId = 'exam' | 'practice' | 'daily' | 'api';

export interface Preset {
  id: PresetId;
  kind: ShareKind;
  icon: string;
  policy: SharePolicy;
}

const AGENT = DEFAULT_POLICIES.agent;

/** One question a day through n8n (WhatsApp, Telegram), its answer six hours later. */
const DAILY: SharePolicy = {
  ...AGENT,
  content: { ...AGENT.content, size: 1 },
  limits: { ...AGENT.limits, batchesPerDay: 1 },
  reveal: { level: 'explained', when: 'after_hours', hours: 6 },
};

/** The four starting points of a new share; everything stays editable after the pick. */
export const PRESETS: readonly Preset[] = [
  { id: 'exam', kind: 'exam', icon: '🎓', policy: DEFAULT_POLICIES.exam },
  { id: 'practice', kind: 'practice', icon: '📝', policy: DEFAULT_POLICIES.practice },
  { id: 'daily', kind: 'agent', icon: '💬', policy: DAILY },
  { id: 'api', kind: 'agent', icon: '🔌', policy: AGENT },
];

const ISSUE_KEYS: Record<string, MessageKey> = {
  access_for_kind: 'sharing.issue.access_for_kind',
  batch_max_10: 'sharing.issue.batch_max_10',
  agent_reveals_answers: 'sharing.issue.agent_reveals_answers',
  ends_before_start: 'sharing.issue.ends_before_start',
  hours_required: 'sharing.issue.hours_required',
  end_required: 'sharing.issue.end_required',
};

const SHAPE_KEYS: Record<string, MessageKey> = {
  too_small: 'field.tooShort',
  too_big: 'field.tooLong',
};

/**
 * The contract's policy shape and rules as friendly field errors, keyed by the field's path inside
 * the policy (`limits.endsAt`). The server checks the same rules and stays the authority.
 */
export function issueFields(kind: ShareKind, policy: SharePolicy): Record<string, MessageKey> {
  const fields: Record<string, MessageKey> = {};
  for (const issue of SharePolicySchema.safeParse(policy).error?.issues ?? [])
    fields[issue.path.join('.')] ??= SHAPE_KEYS[issue.code] ?? 'field.invalid';
  for (const issue of policyIssues(kind, policy)) {
    const field = issue.path.slice(1).join('.');
    fields[field] ??= ISSUE_KEYS[issue.message] ?? 'field.invalid';
  }
  return fields;
}
