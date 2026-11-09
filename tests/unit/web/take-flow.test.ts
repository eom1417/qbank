import { describe, expect, it, vi } from 'vitest';
import type {
  TakeItemResponse,
  TakeLandingResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../src/contracts/take.js';
import { ApiError } from '../../../src/web/platform/api/client.js';
import { attemptStore } from '../../../src/web/capabilities/take/attempt-store.js';
import {
  begin,
  enter,
  navigationOf,
  saveChoice,
} from '../../../src/web/capabilities/take/take-flow.js';

const LINK = 'qbt_link';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return attemptStore({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  });
}

const state = (status: TakeStateResponse['status']) =>
  ({ status, position: 2, total: 5 }) as TakeStateResponse;
const landing = { name: 'Cardiology quiz' } as TakeLandingResponse;
const result = { status: 'submitted', score: null, items: null } as TakeResultResponse;

function deps(attempt: { state(): Promise<TakeStateResponse> }) {
  const landingCall = vi.fn(async () => landing);
  const tokens: string[] = [];
  return {
    landingCall,
    tokens,
    deps: {
      landing: landingCall,
      attempt: (token: string) => {
        tokens.push(token);
        return { state: attempt.state, result: async () => result };
      },
    },
  };
}

describe('opening a shared link (M30)', () => {
  it('resumes the attempt this browser kept, without showing the rules again', async () => {
    const store = memoryStore({ [`qb.take.${LINK}`]: 'qba_kept' });
    const fake = deps({ state: async () => state('active') });
    const entry = await enter(LINK, store, fake.deps);
    expect(entry).toEqual({ phase: 'attempt', token: 'qba_kept', state: state('active') });
    expect(fake.tokens).toEqual(['qba_kept']);
    expect(fake.landingCall).not.toHaveBeenCalled();
  });

  it('shows the result of a kept attempt that was already submitted', async () => {
    const store = memoryStore({ [`qb.take.${LINK}`]: 'qba_kept' });
    const entry = await enter(LINK, store, deps({ state: async () => state('submitted') }).deps);
    expect(entry).toEqual({ phase: 'result', token: 'qba_kept', result });
  });

  it('forgets a token the server no longer knows and shows the rules', async () => {
    const store = memoryStore({ [`qb.take.${LINK}`]: 'qba_gone' });
    const fake = deps({ state: () => Promise.reject(new ApiError('unauthenticated')) });
    expect(await enter(LINK, store, fake.deps)).toEqual({ phase: 'landing', landing });
    expect(store.read(LINK)).toBeNull();
  });

  it('keeps the token when the connection is lost, so a retry resumes the same attempt', async () => {
    const store = memoryStore({ [`qb.take.${LINK}`]: 'qba_kept' });
    const fake = deps({ state: () => Promise.reject(new ApiError('network')) });
    await expect(enter(LINK, store, fake.deps)).rejects.toThrow('network');
    expect(store.read(LINK)).toBe('qba_kept');
    expect(fake.landingCall).not.toHaveBeenCalled();
  });

  it('shows the rules when this browser has no attempt for the link', async () => {
    const fake = deps({ state: async () => state('active') });
    expect(await enter(LINK, memoryStore(), fake.deps)).toEqual({ phase: 'landing', landing });
    expect(fake.tokens).toEqual([]);
  });
});

describe('starting an attempt (M30)', () => {
  it('keeps the new attempt token as soon as the attempt starts', async () => {
    const store = memoryStore();
    const start = vi.fn(async () => ({ attemptId: 'id', token: 'qba_new' }));
    expect(await begin(LINK, { name: 'Sara' }, store, start)).toBe('qba_new');
    expect(start).toHaveBeenCalledWith(LINK, { name: 'Sara' });
    expect(store.read(LINK)).toBe('qba_new');
  });

  it('keeps nothing when starting is refused', async () => {
    const store = memoryStore();
    const start = () => Promise.reject(new ApiError('wrong_code'));
    await expect(begin(LINK, { name: 'Sara', code: 'x' }, store, start)).rejects.toThrow();
    expect(store.read(LINK)).toBeNull();
  });
});

describe('saving a choice honestly (M30)', () => {
  const item = { position: 3, saved: ['A'] } as TakeItemResponse;

  it("shows the server's answer once it is saved", async () => {
    const saved = { ...item, saved: ['B'] };
    const outcome = await saveChoice({ choose: async () => saved }, item, ['B']);
    expect(outcome).toEqual({ status: 'saved', item: saved });
  });

  it('says it failed and goes back to the last answer the server confirmed', async () => {
    const choose = () => Promise.reject(new ApiError('network'));
    const outcome = await saveChoice({ choose }, item, ['B']);
    expect(outcome).toEqual({ status: 'failed', item, code: 'network' });
    expect(outcome.item.saved).toEqual(['A']);
  });

  it('carries the reason when the exam has already ended', async () => {
    const choose = () => Promise.reject(new ApiError('exam_ended'));
    expect(await saveChoice({ choose }, item, ['B'])).toMatchObject({ code: 'exam_ended' });
  });
});

describe('moving as the share allows (M30)', () => {
  const allowed = { flag: true, feedbackEachQuestion: false } as const;

  it('forward only: no previous, and the map reaches only this question and later ones', () => {
    const nav = navigationOf({ ...allowed, navigation: 'forward' }, 2, 5);
    expect(nav.canPrevious).toBe(false);
    expect(nav.canNext).toBe(true);
    expect([0, 1, 2, 3, 4].map(nav.canGo)).toEqual([false, false, true, true, true]);
  });

  it('free: back and forth anywhere, but no previous at the first nor next at the last', () => {
    const free = { ...allowed, navigation: 'free' } as const;
    expect(navigationOf(free, 2, 5).canPrevious).toBe(true);
    expect([0, 4].map(navigationOf(free, 2, 5).canGo)).toEqual([true, true]);
    expect(navigationOf(free, 0, 5).canPrevious).toBe(false);
    expect(navigationOf(free, 4, 5).canNext).toBe(false);
  });
});
