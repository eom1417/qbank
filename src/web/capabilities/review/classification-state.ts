import { useState } from 'react';
import type { EditQuestionRequest, QuestionResponse } from '../../../contracts/questions.js';

type Changes = Pick<EditQuestionRequest, 'chapterId' | 'topicId' | 'tagIds' | 'difficulty'>;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * Where the question belongs and how hard it is (FR-03-003, FR-11-003…005). Only what the owner
 * changed is sent: an untouched place stays `suggested`, an untouched difficulty stays inferred.
 */
export function useClassification(question: QuestionResponse) {
  const [chapterId, setChapter] = useState(question.chapterId ?? '');
  const [topicId, setTopicId] = useState(question.topicId ?? '');
  const [tagIds, setTagIds] = useState(question.tags.map((tag) => tag.id));
  const manual = question.difficulty.kind === 'manual' ? String(question.difficulty.value) : '';
  const [difficulty, setDifficulty] = useState(manual);
  const setChapterId = (id: string) => {
    setChapter(id);
    setTopicId('');
  };
  const toggleTag = (id: string) =>
    setTagIds((all) => (all.includes(id) ? all.filter((t) => t !== id) : [...all, id]));
  const changes = (): Changes => ({
    ...(chapterId !== (question.chapterId ?? '') || topicId !== (question.topicId ?? '')
      ? { chapterId: chapterId || null, topicId: topicId || null }
      : {}),
    ...(sameSet(
      tagIds,
      question.tags.map((tag) => tag.id),
    )
      ? {}
      : { tagIds }),
    ...(difficulty !== manual ? { difficulty: difficulty ? Number(difficulty) : null } : {}),
  });
  return {
    chapterId,
    setChapterId,
    topicId,
    setTopicId,
    tagIds,
    toggleTag,
    difficulty,
    setDifficulty,
    changes,
  };
}

export type Classification = ReturnType<typeof useClassification>;
