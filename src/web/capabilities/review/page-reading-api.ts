import { QuestionResponse } from '../../../contracts/questions.js';
import { PageReadingResponse, type ReassembleRequest } from '../../../contracts/review.js';
import { apiRequest } from '../../platform/api/client.js';

/** A question's pages as the import read them, unit by unit with its role (M34 P6, Q26). */
export const fetchPageReading = (id: string) =>
  apiRequest('GET', `/api/questions/${id}/page-reading`, PageReadingResponse);

/** New roles for some units, then the question rebuilt from its units as a new version. */
export const reassembleQuestion = (id: string, body: ReassembleRequest) =>
  apiRequest('POST', `/api/questions/${id}/reassemble`, QuestionResponse, body);
