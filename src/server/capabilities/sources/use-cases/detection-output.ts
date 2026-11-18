import type { DetectionIssue } from '../../../../contracts/detection.js';
import type { Detection } from '../detection/contract.js';
import { decideAnswer } from '../domain/answer-decision.js';
import { asksForSeveral } from '../domain/key-lines.js';
import type { PipelinePicture, PipelineQuestion } from '../domain/pipeline/question.js';
import { evidenceOf } from '../domain/pipeline/statuses.js';
import type { ExtractedQuestion } from './extract-questions.js';
import type { KeptLink, MediaPlace } from './keep-media.js';

/** The answer as the shared decision owner settles it from the question's evidence. */
function decisionOf(question: PipelineQuestion, evidence: ReturnType<typeof evidenceOf>) {
  const marked = evidence === 'pen_mark' || evidence === 'single_option' ? evidence : null;
  return decideAnswer({
    letters: question.options.map((option) => option.letter),
    marked: { answer: marked ? (question.answers[0] ?? null) : null, evidence: marked },
    key: marked || question.answers.length === 0 ? null : question.answers,
    explanation: question.explanation,
  });
}

/** The pipeline question as the screening reads it (its lines as one area per page). */
export function asExtractedQuestion(question: PipelineQuestion): ExtractedQuestion {
  const evidence = evidenceOf(question);
  const decision = decisionOf(question, evidence);
  return {
    number: question.number,
    page: question.page,
    stem: question.stem,
    kind: question.options.length === 0 ? 'essay' : 'mcq',
    options: question.options.map(({ letter, label, text }) => ({ letter, label, text })),
    answer: decision.answers[0] ?? null,
    answers: decision.answers,
    evidence: decision.evidence ?? evidence,
    conflicts: decision.conflicts,
    multiSelect: question.answers.length > 1 || asksForSeveral(question.stem),
    explanation: question.explanation,
    spans: question.area.map((spot) => ({ page: spot.page, box: spot.box })),
  };
}

/** An option picture needs its letter; without one it is shown with the question. */
const placeOf = (picture: PipelinePicture): MediaPlace =>
  picture.placement === 'option' && picture.optionLetter
    ? { placement: 'option', optionLetter: picture.optionLetter }
    : {
        placement: picture.placement === 'option' ? 'question' : picture.placement,
        optionLetter: null,
      };

/** Every kept picture once: a case's pictures are stored with the first question of the case. */
export function asKeptLinks(questions: readonly PipelineQuestion[]): KeptLink[] {
  const seen = new Set<string>();
  return questions.flatMap((question, index) =>
    question.pictures.flatMap((picture): KeptLink[] => {
      if (seen.has(picture.unitId)) return [];
      seen.add(picture.unitId);
      const kind = picture.imageClass === 'table' ? 'table' : 'figure';
      const region = {
        page: picture.spot.page,
        box: picture.spot.box,
        kind,
        ppi: picture.ppi ?? null,
      } as const;
      return [
        { region, question: index, certain: picture.certain ?? true, place: placeOf(picture) },
      ];
    }),
  );
}

/** The exact source locations survive question conversion and are visible without an AI. */
export function asDetectionIssues(detection: Detection): DetectionIssue[] {
  return detection.doubts.map((doubt) => ({
    ...doubt,
    question:
      doubt.question === null ? null : (detection.questions[doubt.question]?.number ?? null),
    pages: [...new Set(doubt.lines.flatMap((id) => detection.file.lines[id]?.page ?? []))],
    lines: doubt.lines.map((id) => id + 1),
  }));
}
