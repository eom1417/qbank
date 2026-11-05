/** English strings of the AI triage choice (DEC-33) and its results. */
export const triageEn = {
  'triage.with':
    'Your AI organizes the file: it finds and splits the questions and links answers printed on other pages, without changing a word. Below, choose what else it improves.',
  'triage.quality': 'How thorough',
  'triage.quality.high': 'High (strongest models, uses more of your plan)',
  'triage.quality.balanced': 'Balanced (recommended)',
  'triage.quality.economy': 'Economy (lightest models)',
  'triage.quality.custom': 'Custom (choose each model)',
  'triage.role.solvers': 'Solving',
  'triage.role.first': 'First solver',
  'triage.role.second': 'Second solver',
  'triage.role.judge': 'Judge',
  'triage.role.improver': 'Organizing and improving',
  'triage.recheck': 'Check again with AI',
  'triage.recheck.lead':
    'Your AI goes through this file’s saved questions again: it organizes them and makes the improvements you choose. Answers you set yourself are never changed.',
  'triage.recheck.start': 'Start the check',
  'triage.fileSaid': 'The file said:',
  'triage.why': 'Why:',
  'enhance.title': 'Improve questions with AI',
  'enhance.lead':
    'Without these, your AI only organizes the file: it finds the questions, splits them, links answers printed on other pages, and keeps every word as printed. Choose what it may improve:',
  'enhance.completeOptions': 'Complete the options',
  'enhance.completeOptions.off': 'Do not add options',
  'enhance.completeOptions.to': 'Up to this many options:',
  'enhance.polishText': 'Polish the wording',
  'enhance.polishText.hint':
    'Spelling, grammar and clarity. Every number, unit and negation (NOT, EXCEPT) is kept, and a rewrite that changes the answer is undone.',
  'enhance.verifyAnswers': 'Check and verify the answers',
  'enhance.verifyAnswers.hint':
    'Two models answer each question on their own, a stronger one settles disagreements; only real disputes come to you.',
  'enhance.topicReview': 'Topic review for incomplete questions',
  'enhance.topicReview.hint':
    'For a question that is only notes, missing data, or unclear: a short review of its topic from authoritative sources found on the web, with "if it were… then…" variations.',
  'enhance.explainOptions': 'Explain every option',
  'enhance.explainOptions.hint':
    'A short note on why each option is right or wrong, for every answered question.',
  'enhance.updateNotes': 'Note outdated answers',
  'enhance.updateNotes.hint':
    'When the book’s answer follows an older guideline, a separate note says what current guidance says. The book’s answer is not changed.',
  'enhance.classify': 'Suggest chapter, topic and difficulty',
  'enhance.classify.hint':
    'From your bank’s own chapters and topics; your own choices are never replaced.',
  'enhance.duplicates': 'Find questions that ask the same thing',
  'enhance.duplicates.hint': 'Listed for you to compare, never merged.',
  'change.organized': 'organized by AI',
  'change.polished': 'reworded by AI',
  'change.options_added': 'options added by AI',
  'change.answer_from_text': 'answer found in the text',
  'change.answer_verified': 'answer verified by AI',
  'change.answer_corrected': 'answer corrected by AI',
  'change.study_note': 'study note',
  'change.update_note': 'update note by AI',
  'change.classified': 'classified by AI',
  'note.title': 'Study note (AI)',
  'note.topicReview': 'Topic review (AI)',
  'note.keyIdea': 'Key idea',
  'note.whyAnswer': 'The answer',
  'note.options': 'The options',
  'note.ifThen': 'If it were…',
  'note.pearls': 'Remember',
  'note.sources': 'Sources',
  'note.issue': 'About this question',
  'note.unverifiedSource': '(not opened)',
  'topics.title': 'Topic cards',
  'topics.lead':
    'Questions you cannot answer as printed (only notes, missing data, unclear): read each one, think, then show its topic review.',
  'topics.empty':
    'No topic cards yet. They appear when "Topic review for incomplete questions" runs on an import or a check.',
  'topics.show': 'Show the review',
  'topics.hide': 'Hide',
  'topics.open': 'Topic cards',
} as const;
