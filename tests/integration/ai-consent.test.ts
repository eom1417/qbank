import { describe, expect, it } from 'vitest';
import {
  createClient,
  ownerWithBank,
  pairedBrowser,
  registeredBrowser,
} from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { pageRangeReply, uploadFile, usePdfFixtures } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P5 (Q8, Z4): an import by the pipeline sends the file to the owner's own AI provider, so
// the account agrees to it once. On a server there is no import without AI (Q7, Z4).

const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings, importRequiresAi: true });
const local = useTestApp({ local: true });
const pipelineFile = usePipelineFile();
const fixtures = usePdfFixtures();

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

  it('refuses on a server an import without AI or by an older mode, storing nothing', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await owner.post('/api/account/ai-consent', {});
    const plain = await uploadFile(app(), owner.cookie(), bankId, pipelineFile());
    expect(plain.statusCode).toBe(409);
    expect(plain.json().error.code).toBe('ai_required');
    for (const aiMode of ['verify', 'read']) {
      const older = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
        ...withLesson,
        aiMode,
      });
      expect(older.statusCode).toBe(409);
      expect(older.json().error.code).toBe('ai_required');
    }
    expect((await owner.get(`/api/banks/${bankId}/sources`)).json().sources).toEqual([]);
  });

  it('still names what is wrong with a bad file before asking for the AI', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const text = await uploadFile(app(), owner.cookie(), bankId, fixtures().text);
    expect([text.statusCode, text.json().error.code]).toEqual([415, 'file_unsupported']);
    const upload = { cookie: owner.cookie(), bankId, file: pipelineFile() };
    const range = await pageRangeReply(app(), upload, '1', '999');
    expect(range).toEqual([400, { pageTo: 'too_big' }]);
  });
});

describe('starting an import on a local install', () => {
  it('keeps an import without AI and an explicit older mode, free of the consent', async () => {
    const { browser } = await pairedBrowser(local());
    const bankId = (await browser.post('/api/banks', { name: 'Local' })).json().id as string;
    const plain = await uploadFile(local(), browser.cookie(), bankId, pipelineFile());
    expect(plain.statusCode).toBe(201);
    expect(plain.json().ai).toBeNull();
  });
});
