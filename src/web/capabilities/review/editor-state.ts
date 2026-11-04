import { useState } from 'react';
import type { EditQuestionRequest, QuestionResponse } from '../../../contracts/questions.js';

const LETTERS = 'ABCDEFGHIJ'.split('');

export interface DraftOption {
  letter: string;
  text: string;
}

/** The editor's working copy of a question: changed freely, saved as one edit. */
export function useEditorState(question: QuestionResponse) {
  const [stem, setStem] = useState(question.stem);
  const [options, setOptions] = useState<DraftOption[]>(
    question.options.map((o) => ({ letter: o.letter, text: o.text })),
  );
  const [answers, setAnswers] = useState<string[]>(question.answers);
  const [explanation, setExplanation] = useState(question.explanation ?? '');
  const [updateNote, setUpdateNote] = useState(question.updateNote ?? '');
  const setOptionText = (letter: string, text: string) =>
    setOptions((all) => all.map((o) => (o.letter === letter ? { ...o, text } : o)));
  const toggleAnswer = (letter: string) =>
    setAnswers((all) =>
      all.includes(letter) ? all.filter((l) => l !== letter) : [...all, letter].sort(),
    );
  const nextLetter = LETTERS.find((letter) => !options.some((o) => o.letter === letter));
  const addOption = () =>
    nextLetter && setOptions((all) => [...all, { letter: nextLetter, text: '' }]);
  const removeOption = (letter: string) => {
    setOptions((all) => all.filter((o) => o.letter !== letter));
    setAnswers((all) => all.filter((l) => l !== letter));
  };
  const request = (): EditQuestionRequest => ({
    expectedVersion: question.version,
    stem,
    options,
    answers,
    explanation: explanation.trim() === '' ? null : explanation,
    updateNote: updateNote.trim() === '' ? null : updateNote,
  });
  return {
    stem,
    setStem,
    options,
    answers,
    explanation,
    setExplanation,
    updateNote,
    setUpdateNote,
    setOptionText,
    toggleAnswer,
    addOption,
    canAdd: nextLetter !== undefined,
    removeOption,
    request,
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
