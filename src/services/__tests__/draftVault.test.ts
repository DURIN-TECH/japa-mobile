// Draft vault (issue #187): key encoding, chunking round-trip, 7-day expiry,
// delete and clear-all. expo-secure-store is mocked with an in-memory map that
// also enforces the real key rule and flags values over 2048 bytes.

const mockMem = new Map<string, string>();
let mockOversize = 0;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key');
    if (new TextEncoder().encode(v).length > 2048) mockOversize++;
    mockMem.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockMem.delete(k);
  }),
}));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CHUNK_BYTES,
  DRAFT_MAX_AGE_MS,
  chunkText,
  clearAllDrafts,
  decodeId,
  deleteDraft,
  draftBaseKey,
  encodeId,
  loadDrafts,
  saveDraft,
} from '../draftVault';

beforeEach(() => {
  mockMem.clear();
  mockOversize = 0;
});

describe('key encoding', () => {
  it('yields only SecureStore-legal characters and round-trips', () => {
    for (const id of ['abc123', 'docreq:xyz/1', 'a_b.c d', 'é漢😀']) {
      const enc = encodeId(id);
      expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeId(enc)).toBe(id);
    }
    expect(draftBaseKey('app:1', 'item/2')).toMatch(/^[A-Za-z0-9._-]+$/);
  });
  it('different ids never share a key', () => {
    expect(draftBaseKey('a', 'b.c')).not.toBe(draftBaseKey('a.b', 'c'));
  });
});

describe('chunking', () => {
  it('splits by UTF-8 size and reassembles, including multi-byte text', () => {
    const text = '漢😀é'.repeat(900);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks)
      expect(new TextEncoder().encode(c).length).toBeLessThanOrEqual(
        CHUNK_BYTES,
      );
    expect(chunks.join('')).toBe(text);
  });
  it('a stored 2000-char draft round-trips and never writes an mockOversize value', async () => {
    const text = 'é'.repeat(2000); // 4000 bytes
    await saveDraft('app1', 'i1', text, 1000);
    expect(mockOversize).toBe(0);
    const [d] = await loadDrafts(1000);
    expect(d).toEqual({
      applicationId: 'app1',
      itemId: 'i1',
      text,
      updatedAt: 1000,
    });
  });
  it('overwriting with shorter text leaves no stale chunks', async () => {
    await saveDraft('app1', 'i1', 'x'.repeat(5000), 1);
    await saveDraft('app1', 'i1', 'short', 2);
    expect([...mockMem.keys()].filter((k) => /\.c\d+$/.test(k)).length).toBe(1);
    expect((await loadDrafts(2))[0].text).toBe('short');
  });
});

describe('expiry', () => {
  it('drops drafts older than 7 days and deletes them from the vault', async () => {
    await saveDraft('app1', 'old', 'a', 0);
    await saveDraft('app1', 'new', 'b', DRAFT_MAX_AGE_MS);
    const loaded = await loadDrafts(DRAFT_MAX_AGE_MS + 1);
    expect(loaded.map((d) => d.itemId)).toEqual(['new']);
    expect([...mockMem.keys()].some((k) => k.includes('old'))).toBe(false);
  });
});

describe('serialised operations', () => {
  it('a clearAll queued behind in-flight saves still clears them (no index race)', async () => {
    // Fired without awaiting: overlapping calls, then the clear.
    const ops = [
      saveDraft('app1', 'i1', 'a'),
      saveDraft('app1', 'i2', 'b'.repeat(4000)),
      saveDraft('app2', 'i1', 'c'),
      clearAllDrafts(),
    ];
    await Promise.all(ops);
    expect(mockMem.size).toBe(0);
    expect(await loadDrafts()).toEqual([]);
  });
  it('overlapping saves all land in the index', async () => {
    await Promise.all([
      saveDraft('app1', 'i1', 'a'),
      saveDraft('app1', 'i2', 'b'),
      saveDraft('app1', 'i3', 'c'),
    ]);
    expect((await loadDrafts()).map((d) => d.itemId).sort()).toEqual([
      'i1',
      'i2',
      'i3',
    ]);
  });
});

describe('delete', () => {
  it('deleteDraft removes one; clearAllDrafts removes everything', async () => {
    await saveDraft('app1', 'i1', 'a');
    await saveDraft('app1', 'i2', 'b');
    await deleteDraft('app1', 'i1');
    expect((await loadDrafts()).map((d) => d.itemId)).toEqual(['i2']);
    await clearAllDrafts();
    expect(mockMem.size).toBe(0);
  });
});
