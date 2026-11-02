import type { BankResponse, ChapterResponse } from '../../../../contracts/library.js';
import type { Bank } from '../domain/bank.js';
import type { Chapter } from '../domain/taxonomy.js';

export const toBankResponse = (bank: Bank): BankResponse => ({
  id: bank.id,
  name: bank.name,
  description: bank.description,
  subject: bank.subject,
  archived: bank.archivedAt !== null,
  createdAt: bank.createdAt.toISOString(),
  updatedAt: bank.updatedAt.toISOString(),
});

export const toChapterResponse = (chapter: Chapter): ChapterResponse => ({
  id: chapter.id,
  name: chapter.name,
  topics: chapter.topics.map((topic) => ({ id: topic.id, name: topic.name })),
});
