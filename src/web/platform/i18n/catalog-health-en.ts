/** Strings of system health (M17.3): shown in the app only, nothing is sent anywhere. */
export const healthEn = {
  'health.title': 'System health',
  'health.allGood': 'Everything works.',
  'health.ok': 'fine',
  'health.attention': 'needs attention',
  'health.never': 'never',
  'health.ai': 'AI service',
  'health.ai.ready': 'providers signed in',
  'health.ai.unreachable': 'not answering',
  'health.ai.not_configured': 'not set up (optional)',
  'health.disk': 'Disk',
  'health.disk.free': 'free',
  'health.backup': 'Last backup',
  'health.imports': 'Imports this week',
  'health.imports.fine': 'none failed',
  'health.imports.failed': 'could not be imported:',
  'health.imports.partial': 'imported only in part:',
  'health.log': 'QBank keeps its log here (no questions or notes in it):',
  'health.open': 'See what to do',
  'health.problem.ai_unreachable':
    'The AI service is not answering. Restart QBank; your library still works without it.',
  'health.problem.disk_low':
    'Less than 1 GB of disk is free: new imports and backups may not fit. Free some space.',
  'health.problem.backup_old':
    'No backup for two days. Keep QBank running a while, or back up now in Settings.',
  'health.problem.import_failed':
    'An import this week did not finish. Open its report to retry or see why.',
};
