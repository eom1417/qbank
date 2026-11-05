/** English strings of the AI triage choice (DEC-33) and its results. */
export const triageEn = {
  'triage.with':
    'Your AI checks every question: two models answer each one on their own, a stronger one settles any disagreement, and only real disputes come to you.',
  'triage.quality': 'How thorough',
  'triage.quality.high': 'High (strongest models, uses more of your plan)',
  'triage.quality.balanced': 'Balanced (recommended)',
  'triage.quality.economy': 'Economy (lightest models)',
  'triage.quality.custom': 'Custom (choose each model)',
  'triage.role.solvers': 'Solving',
  'triage.role.first': 'First solver',
  'triage.role.second': 'Second solver',
  'triage.role.judge': 'Judge',
  'triage.role.improver': 'Improving',
  'triage.improve': 'Improve the questions first',
  'triage.improve.hint':
    'Fixes spelling, grammar and reading noise without changing what is asked, and gives questions with fewer than 3 options plausible wrong options (4 in all). The original stays in the question history.',
  'triage.recheck': 'Check again with AI',
  'triage.recheck.lead':
    'Your AI checks this file’s questions again: it settles their answers and, if you choose, improves them. Answers you set yourself are never changed.',
  'triage.recheck.start': 'Start the check',
  'triage.fileSaid': 'The file said:',
  'triage.why': 'Why:',
  'triage.improve.off': 'questions not improved',
} as const;
