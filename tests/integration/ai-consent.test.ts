import { describe, expect, it } from 'vitest';
import { createClient, ownerWithBank, registeredBrowser } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { uploadFile } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P5 (Q8, Z4): an import by the pipeline sends the file to the owner's own AI provider, so
// the account agrees to it once; the server reads with the pipeline unless the upload chose.

const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings });
const pipelineFile = usePipelineFile();

const withLesson = { aiProviderId: FAKE_INSTANCES.lesson };

describe('the AI consent (Q8)', () => {
  it('is recorded once, by the owner only, behind the origin guard', async () => {
    expect((await createClient(app()).post('/api/account/ai-consent', {})).statusCode).toBe(401);
    const { browser } = await registeredBrowser(app());
    expect((await browser.get('/api/auth/me')).json().aiConsentAt).toBeNull();
    const foreign = await browser.post('/api/account/ai-consent', {}, 'http://evil.test');
    expect(foreign.statusCode).toBe(403);
    expect((await browser.get('/api/auth/me')).json().aiConsentAt).toBeNull();
    const first = await browser.post('/api/account/ai-consent', {});
    expect(first.statusCode).toBe(200);
    const at = first.json().aiConsentAt as string;
    expect(new Date(at).getTime()).not.toBeNaN();
    const again = await browser.post('/api/account/ai-consent', {});
    expect(again.json().aiConsentAt).toBe(at);
    expect((await browser.get('/api/auth/me')).json().aiConsentAt).toBe(at);
  });
});

describe('starting a pipeline import', () => {
  it('refuses an import with an AI before the consent, storing nothing', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const refused = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), withLesson);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('ai_consent_required');
    expect((await owner.get(`/api/banks/${bankId}/sources`)).json().sources).toEqual([]);
  });

  it('reads with the pipeline on a server once the account agreed', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await owner.post('/api/account/ai-consent', {});
    const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), withLesson);
    expect(started.statusCode).toBe(201);
    expect(started.json().ai).toMatchObject({ mode: 'pipeline', usage: [], resumesAt: null });
  });

  it('keeps an explicit older mode and an import without AI free of the consent', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const verify = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
      ...withLesson,
      aiMode: 'verify',
    });
    expect(verify.statusCode).toBe(201);
    expect(verify.json().ai.mode).toBe('verify');
    const plain = await uploadFile(app(), owner.cookie(), bankId, pipelineFile());
    expect(plain.statusCode).toBe(201);
    expect(plain.json().ai).toBeNull();
  });
});
