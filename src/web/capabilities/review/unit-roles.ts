import type { MessageKey } from '../../platform/i18n/i18n.js';

// M34 P6 (Q26): how the review editor draws and names a unit's role. Colours are the design
// system's semantic tokens; a picture is drawn dashed, another question's unit dotted.

export type RoleGroup = 'stem' | 'option' | 'explanation' | 'case' | 'filler' | 'dropped' | 'other';

export const ROLE_GROUPS: readonly RoleGroup[] = [
  'stem',
  'option',
  'explanation',
  'case',
  'filler',
  'dropped',
  'other',
];

const COLOURS: Readonly<Record<RoleGroup, string>> = {
  stem: 'var(--color-accent)',
  option: 'var(--color-success)',
  explanation: 'var(--color-warning)',
  case: 'var(--color-focus)',
  filler: 'var(--color-border-strong)',
  dropped: 'var(--color-danger)',
  other: 'var(--color-text-muted)',
};

/** The colour group of a role (a picture's role is coloured like the part it is placed in). */
export function groupOf(role: string, editable: boolean): RoleGroup {
  if (!editable && role !== 'filler') return 'other';
  const part = role.replace(/^picture:/, '');
  if (part.startsWith('option:')) return 'option';
  if (part === 'question') return 'stem';
  return (ROLE_GROUPS as readonly string[]).includes(part) ? (part as RoleGroup) : 'dropped';
}

export const colourOf = (group: RoleGroup) => COLOURS[group];

/** The dash pattern: pictures dashed, other questions' units dotted, text solid. */
export function dashOf(kind: string, group: RoleGroup): string | undefined {
  if (group === 'other') return '2 3';
  return kind === 'image' ? '8 4' : undefined;
}

/** A role in words: "Option B", "Picture in the explanation"… */
export function roleLabel(t: (key: MessageKey) => string, role: string): string {
  const letter = /option:([A-J])$/.exec(role)?.[1];
  const picture = role.startsWith('picture:');
  if (letter) return `${t(picture ? 'role.picture.option' : 'role.option')} ${letter}`;
  const keys: Record<string, MessageKey> = {
    stem: 'role.stem',
    explanation: 'role.explanation',
    case: 'role.case',
    filler: 'role.filler',
    dropped: 'role.dropped',
    'picture:question': 'role.picture.question',
    'picture:explanation': 'role.picture.explanation',
  };
  const key = keys[role];
  return key ? t(key) : role;
}

/** The legend's words for a colour group. */
export const GROUP_KEYS: Readonly<Record<RoleGroup, MessageKey>> = {
  stem: 'role.stem',
  option: 'role.option',
  explanation: 'role.explanation',
  case: 'role.case',
  filler: 'role.filler',
  dropped: 'role.dropped',
  other: 'editor.pageReading.locked',
};
