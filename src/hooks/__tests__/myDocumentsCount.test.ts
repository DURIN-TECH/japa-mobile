// ─────────────────────────────────────────────────────────────────────────────
// fetchMyDocuments + uploadedFileCount (japa#346): the Profile "My documents"
// count must tell "none" from "couldn't load". Mocked API, no network.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn() },
}));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  MY_DOCUMENTS_APP_CAP,
  fetchMyDocuments,
  uploadedFileCount,
} from '../useDocuments';
import { apiService } from '@/services/api.service';

const get = apiService.get as unknown as jest.Mock<
  (url: string) => Promise<unknown>
>;

const app = (id: string) => ({ id, visaTypeName: 'Visa', countryCode: 'GB' });
const doc = (id: string, status: string) => ({
  id,
  status,
  fileName: `${id}.pdf`,
});

// Route the mock by URL: `apps` answers GET /applications, `docs[appId]`
// answers that application's documents (an Error rejects).
function serve(apps: unknown, docs: Record<string, unknown> = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/applications') {
      if (apps instanceof Error) throw apps;
      return { data: apps };
    }
    const id = url.split('/')[2];
    const d = docs[id] ?? [];
    if (d instanceof Error) throw d;
    return { data: d };
  });
}

beforeEach(() => {
  get.mockReset();
});

describe('My documents count', () => {
  it('loaded: counts uploaded files, not upload placeholders', async () => {
    serve([app('a1'), app('a2')], {
      a1: [doc('d1', 'verified'), doc('d2', 'pending_upload')],
      a2: [
        doc('d3', 'under_review'),
        doc('d4', 'rejected'),
        doc('d5', 'uploading'),
      ],
    });
    const r = await fetchMyDocuments();
    expect(r.complete).toBe(true);
    expect(r.docs).toHaveLength(5); // the list keeps every row
    expect(uploadedFileCount(r)).toBe(3);
  });

  it('none: 0, not unknown', async () => {
    serve([app('a1')], { a1: [] });
    expect(uploadedFileCount(await fetchMyDocuments())).toBe(0);
    serve([]);
    expect(uploadedFileCount(await fetchMyDocuments())).toBe(0);
  });

  it('applications request fails → unknown', async () => {
    serve(new Error('500'));
    const r = await fetchMyDocuments();
    expect(r).toEqual({ docs: [], complete: false });
    expect(uploadedFileCount(r)).toBeNull();
  });

  it('one documents request fails → unknown, but the list keeps what loaded', async () => {
    serve([app('a1'), app('a2')], {
      a1: [doc('d1', 'verified')],
      a2: new Error('500'),
    });
    const r = await fetchMyDocuments();
    expect(r.docs.map((d) => d.doc.id)).toEqual(['d1']);
    expect(uploadedFileCount(r)).toBeNull();
  });

  it('more applications than the cap → unknown, never an undercount', async () => {
    const apps = Array.from({ length: MY_DOCUMENTS_APP_CAP + 1 }, (_, i) =>
      app(`a${i}`),
    );
    serve(apps, { a0: [doc('d1', 'verified')] });
    const r = await fetchMyDocuments();
    // Only the capped number of applications was fanned out over.
    expect(get).toHaveBeenCalledTimes(MY_DOCUMENTS_APP_CAP + 1);
    expect(uploadedFileCount(r)).toBeNull();
  });

  it('exactly at the cap → still complete', async () => {
    const apps = Array.from({ length: MY_DOCUMENTS_APP_CAP }, (_, i) =>
      app(`a${i}`),
    );
    serve(apps);
    expect(uploadedFileCount(await fetchMyDocuments())).toBe(0);
  });
});
