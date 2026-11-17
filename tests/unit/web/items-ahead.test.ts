import { describe, expect, it, vi } from 'vitest';
import { itemsAhead } from '../../../src/web/capabilities/exam-ui/items-ahead.js';
import { pictureCache } from '../../../src/web/capabilities/take/picture-cache.js';

interface Item {
  position: number;
  total: number;
  stem: string;
}

const item = (position: number, total = 5): Item => ({ position, total, stem: `Q${position}` });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('questions fetched ahead (M34 U3)', () => {
  it('fetches the next and the previous question once, and warms their pictures', async () => {
    const peek = vi.fn(async (position: number) => item(position));
    const warm = vi.fn();
    const ahead = itemsAhead(peek, warm, { previous: true });
    ahead.around(item(2));
    ahead.around(item(2));
    await settle();
    expect(peek.mock.calls.map(([p]) => p).sort()).toEqual([1, 3]);
    expect(warm.mock.calls.map(([i]) => (i as Item).position).sort()).toEqual([1, 3]);
    expect(ahead.ready(3)?.stem).toBe('Q3');
    expect(ahead.ready(2)?.stem).toBe('Q2');
  });
});

describe('questions fetched ahead: only around the shown one (M34 U3)', () => {
  it('keeps only the current question and its neighbours', async () => {
    const ahead = itemsAhead(async (position: number) => item(position), vi.fn(), {
      previous: true,
    });
    ahead.around(item(1));
    await settle();
    ahead.around(item(2));
    await settle();
    expect(ahead.ready(0)).toBeUndefined();
    expect([1, 2, 3].map((p) => ahead.ready(p)?.position)).toEqual([1, 2, 3]);
  });

  it('asks only for the next question when the way back is not fetched ahead', async () => {
    const peek = vi.fn(async (position: number) => item(position));
    itemsAhead(peek, vi.fn(), { previous: false }).around(item(2));
    await settle();
    expect(peek.mock.calls.map(([p]) => p)).toEqual([3]);
  });

  it('never asks past either end of the exam', async () => {
    const peek = vi.fn(async (position: number) => item(position, 1));
    itemsAhead(peek, vi.fn(), { previous: true }).around(item(0, 1));
    await settle();
    expect(peek).not.toHaveBeenCalled();
  });
});

describe('questions fetched ahead: refusals and late answers (M34 U3)', () => {
  it('forgets a refused fetch, so it is asked again later, and never shows it', async () => {
    const peek = vi.fn(async () => Promise.reject(new Error('not_found')));
    const ahead = itemsAhead<Item>(peek, vi.fn(), { previous: false });
    ahead.around(item(0));
    await settle();
    expect(ahead.ready(1)).toBeUndefined();
    ahead.around(item(0));
    expect(peek).toHaveBeenCalledTimes(2);
  });

  it('drops an answer that arrives after its question went out of range', async () => {
    const pending = new Map<number, (value: Item) => void>();
    const peek = vi.fn(
      (position: number) => new Promise<Item>((resolve) => pending.set(position, resolve)),
    );
    const warm = vi.fn();
    const ahead = itemsAhead<Item>(peek, warm, { previous: false });
    ahead.around(item(0));
    ahead.around(item(3));
    pending.get(1)?.(item(1));
    await settle();
    expect(ahead.ready(1)).toBeUndefined();
    expect(warm).not.toHaveBeenCalled();
  });
});

describe('pictures kept for the attempt (M34 U3)', () => {
  const urls = () => {
    let n = 0;
    const revoked: string[] = [];
    return {
      revoked,
      make: () => `blob:${++n}`,
      revoke: (url: string) => void revoked.push(url),
    };
  };

  it('fetches a picture once, however often it is asked for', async () => {
    const fetchBlob = vi.fn(async () => new Blob(['png']));
    const u = urls();
    const cache = pictureCache(fetchBlob, u.make, u.revoke);
    await Promise.all([cache.load('a'), cache.load('a')]);
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    expect(cache.url('a')).toBe('blob:1');
  });

  it('releases the pictures no longer kept, and everything at the end', async () => {
    const u = urls();
    const cache = pictureCache(async () => new Blob(['png']), u.make, u.revoke);
    await Promise.all([cache.load('a'), cache.load('b')]);
    cache.keep(['b']);
    expect([cache.url('a'), cache.url('b')]).toEqual([null, 'blob:2']);
    expect(u.revoked).toEqual(['blob:1']);
    cache.release();
    expect(u.revoked).toEqual(['blob:1', 'blob:2']);
  });

  it('leaves a picture that failed out of view, and tries it again later', async () => {
    const fetchBlob = vi.fn().mockRejectedValueOnce(new Error('404'));
    fetchBlob.mockResolvedValue(new Blob(['png']));
    const u = urls();
    const cache = pictureCache(fetchBlob, u.make, u.revoke);
    expect(await cache.load('a')).toBeNull();
    expect(cache.url('a')).toBeNull();
    expect(await cache.load('a')).toBe('blob:1');
  });
});
