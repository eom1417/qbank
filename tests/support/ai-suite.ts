import type { createClient } from './client.js';
import { FAKE_INSTANCES, useFakeAiHost } from './fake-ai-host.js';
import { runImports } from './imports.js';
import { useReviewSuite, type SeedQuestion } from './questions.js';

type Browser = ReturnType<typeof createClient>;

/** Options lettered A, B, C… with these texts, as an import saves them. */
export const lettered = (...texts: string[]) =>
  texts.map((text, index) => {
    const letter = String.fromCharCode(65 + index);
    return { letter, label: `${letter}.`, text };
  });

/**
 * A suite whose app runs the user's AI on the fake host (DEC-33, DEC-34): seeding, a question's
 * row, and the fake's requests. Call it at the top of the file.
 */
export function useAiSuite() {
  const fakeHost = useFakeAiHost();
  const { app, seed } = useReviewSuite({ aiHost: () => fakeHost().settings });
  const rowOf = (id: string) =>
    app.db().selectFrom('question').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  /** Seeds questions into a new source of the owner's bank; returns their ids and the source. */
  const seeded = async (owner: Browser, bankId: string, questions: SeedQuestion[]) => {
    const ids = await seed(owner, bankId, questions);
    return { ids, sourceId: (await rowOf(ids[0] ?? '')).source_id };
  };
  /** Starts a re-check, runs it, and returns its import report. */
  const recheckNow = async (owner: Browser, sourceId: string, body: object) => {
    const started = await owner.post(`/api/sources/${sourceId}/recheck`, body);
    await runImports(app());
    return { started, job: (await owner.get(`/api/imports/${started.json().id}`)).json() };
  };
  return { app, rowOf, seeded, recheckNow, fakeHost, instance: FAKE_INSTANCES.vision };
}
