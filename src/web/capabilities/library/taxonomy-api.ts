import { z } from 'zod';
import {
  ChapterResponse,
  TagListResponse,
  TagResponse,
  TaxonomyResponse,
  TopicResponse,
} from '../../../contracts/library.js';
import { apiRequest } from '../../platform/api/client.js';
import { bankPath } from './api.js';

/** Chapters, topics and tags (FR-03-003, FR-11-004). */
export const fetchTaxonomy = (bankId: string) =>
  apiRequest('GET', `${bankPath(bankId)}/taxonomy`, TaxonomyResponse);

export const addChapter = (bankId: string, name: string) =>
  apiRequest('POST', `${bankPath(bankId)}/chapters`, ChapterResponse, { name });

export const addTopic = (chapterId: string, name: string) =>
  apiRequest('POST', `/api/chapters/${chapterId}/topics`, TopicResponse, { name });

type Named = 'chapters' | 'topics' | 'tags';

export const renameNamed = (kind: Named, id: string, name: string) =>
  apiRequest('PATCH', `/api/${kind}/${id}`, z.null(), { name });

export const deleteNamed = (kind: Named, id: string) =>
  apiRequest('DELETE', `/api/${kind}/${id}`, z.null());

export const fetchTags = () => apiRequest('GET', '/api/tags', TagListResponse);

export const createTag = (name: string) => apiRequest('POST', '/api/tags', TagResponse, { name });
