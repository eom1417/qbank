/** Strings of the server operator's console and the server-only flows it serves (M31, DEC-40). */
export const operatorEn = {
  'operator.title': 'Server administration',
  'operator.nav': 'Administration',
  'operator.lead':
    'What the people using this site need from you. You see who asked and when, never their banks or questions.',
  'operator.refresh': 'Refresh',
  'operator.feedback.title': 'Feedback',
  'operator.feedback.empty':
    'No open notes. When someone uses "Send feedback" in Help, their note appears here.',
  'operator.feedback.meta': '{name} · {email} · {when}',
  'operator.feedback.where': 'Screen: {screen} · Version: {version}',
  'operator.feedback.close': 'Mark handled',
  'operator.resets.title': 'Password resets',
  'operator.resets.lead':
    'Send each person their link yourself, by WhatsApp or text message. Each link works for one hour.',
  'operator.resets.empty':
    'No one is waiting for a reset link. A request appears here when someone uses "Forgot your password?".',
  'operator.resets.requested': 'Asked {when}',
  'operator.resets.validUntil': 'Link valid until {when}',
  'operator.resets.expired': 'Expired',
  'operator.resets.expiredHint':
    'This request has expired. Copying or sending the link makes a new one that works for an hour, so they do not need to ask again.',
  'operator.resets.copy': 'Copy link',
  'operator.resets.copied': 'Link copied',
  'operator.resets.whatsapp': 'Send by WhatsApp',
  'operator.resets.fresh':
    'The old link had expired, so a new one was made. It works until {when}.',
  'operator.resets.message':
    'Hello {name}, here is your link to choose a new QBank password. It works for one hour: {link}',
  'operator.queue.title': 'Import queue',
  'operator.queue.workers': 'Up to {n} imports run at the same time, one per account.',
  'operator.queue.empty': 'No imports are running or waiting.',
  'operator.queue.running': 'Running',
  'operator.queue.waiting': 'Waiting',
  'operator.queue.pages': 'Pages {done} of {total}',
  'operator.queue.since': 'Since {when}',
  'feedback.lead.server':
    'A problem, a badly read file or an idea: write it here and it goes straight to {operator}. Nothing from your questions or files is attached.',
  'feedback.toOperator.send': 'Send',
  'feedback.toOperator.sent': 'Sent to {operator}. Thank you.',
  'feedback.toOperator.tooMany':
    'You have sent many notes in the last hour. Wait a little, then send again.',
  'auth.forgot.intro.server':
    'Enter your e-mail. Your request goes to {operator}, who will send you the reset link by WhatsApp or text message. The link works for one hour.',
  'auth.forgot.sent.server':
    'If this e-mail has an account, your request has reached {operator}. They will send you the reset link by WhatsApp or text message, and it works for one hour.',
  'auth.signUp.operator': 'This site is run by {operator}.',
  'auth.signUp.whereData': 'Where is my data?',
  'import.queue.next': 'Yours is next. It starts by itself.',
  'import.queue.ahead.one': 'In the queue: 1 file ahead of yours. Yours starts by itself.',
  'import.queue.ahead.two': 'In the queue: 2 files ahead of yours. Yours starts by itself.',
  'import.queue.ahead.few': 'In the queue: {n} files ahead of yours. Yours starts by itself.',
  'import.queue.ahead.many': 'In the queue: {n} files ahead of yours. Yours starts by itself.',
  'import.queue.ahead.other': 'In the queue: {n} files ahead of yours. Yours starts by itself.',
  'auth.google.continue': 'Continue with Google',
  'auth.google.signUpHint':
    'Your account here uses the e-mail of your Google account. QBank never sees your Google password.',
  'auth.google.error.google': 'Could not sign in with Google. Try again.',
  'auth.google.error.terms': 'Agree to the terms first to create your account.',
  'auth.google.error.too_many_attempts':
    'Too many tries in a short time. Wait a quarter of an hour, then try again.',
  'settings.google.title': 'Signing in',
  'settings.google.signedInAs': 'You sign in with Google:',
  'operator.backup.title': 'Backups',
  'operator.backup.last': 'Last backup {when}',
  'operator.backup.ok': 'Succeeded',
  'operator.backup.failedBadge': 'Failed',
  'operator.backup.kept': 'Backups kept on the server: {n}',
  'operator.backup.none': 'No backup has run on this server yet.',
  'operator.backup.failed':
    'The last backup failed. Check the backup service on the server before data is at risk.',
  'operator.backup.late':
    'The last backup is more than two days old. Check that the backup service is still running.',
} as const;
