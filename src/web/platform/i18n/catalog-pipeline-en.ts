/** Strings of the M34 import pipeline: consent, its stops, usage and its review reasons. */
export const pipelineEn = {
  'error.ai_consent_required':
    'Importing with your AI sends the file to your AI provider: agree to it first.',
  'error.ai_required':
    'On this server a file is imported only with your AI. Choose one of your AI providers, then import again.',
  'import.consent.label':
    'The file’s text and page pictures will be sent to the AI provider you connected.',
  'import.error.ai_not_ready':
    'Your AI connection is not available, so nothing was imported. Check it in AI providers, then retry.',
  'import.error.ai_failed':
    'Your AI stopped before the file was read, so nothing was imported. Check it in AI providers, then retry.',
  'import.ai.providerSaid': 'Your provider said:',
  'import.error.ai_stopped':
    'Your AI stopped partway. The file’s questions are kept, and what needed it waits in review. Retry to finish it.',
  'import.error.no_quota':
    'Your AI subscription stayed at its limit for more than 7 days, so the import stopped. Retry it once the subscription renews.',
  'import.cancelPaused': 'Cancel this import',
  'import.paused':
    'Your AI subscription reached its limit. The import goes on by itself from where it stopped at',
  'import.usage.title': 'AI use',
  'import.usage.lesson': 'Step',
  'import.usage.calls': 'Calls',
  'import.usage.tokens': 'Tokens in / out',
  'import.usage.estimated': 'estimated',
  'import.usage.review': 'Questions sent to review',
  'review.reason.single_option': 'Only one option was printed',
  'review.reason.none_of_options': 'The file says none of the options is right',
  'review.reason.key_doubt': 'The printed key itself is doubtful',
  'review.reason.answer_conflict': 'The file’s answer signs disagree',
  'review.reason.mark_unclear': 'The marked option could not be read',
  'review.reason.picture_unreadable': 'A picture of the question’s words could not be read',
  'review.reason.single_signal': 'The answer rests on one signal only and needs confirming',
  'review.reason.picture_place_unsure':
    'Where a picture belongs is not certain; it is hidden until the reveal',
  'review.reason.unread_question_text':
    'Text shaped like a question after this one was not read; a question may be missing',
};
