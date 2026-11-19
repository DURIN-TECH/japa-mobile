// uploadToStorage: a storage response outside 2xx must throw, so the document
// record is never created for a file that did not land (issue #187 e2e).

jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: jest.fn(),
}));
jest.mock('@/services/api.service', () => ({ apiService: {} }));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uploadAsync } from 'expo-file-system/legacy';
import { uploadToStorage } from '../useDocuments';

const upload = uploadAsync as unknown as jest.Mock<
  (...a: unknown[]) => Promise<{ status: number }>
>;
const file = { uri: 'file:///a.png', type: 'image/png', name: 'a.png' };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('uploadToStorage', () => {
  it('PUTs the file from its uri as binary content', async () => {
    upload.mockResolvedValue({ status: 200 });
    await expect(
      uploadToStorage('https://signed', file),
    ).resolves.toBeUndefined();
    expect(upload).toHaveBeenCalledWith('https://signed', 'file:///a.png', {
      httpMethod: 'PUT',
      uploadType: 0,
      headers: { 'Content-Type': 'image/png' },
    });
  });

  it('throws on a non-2xx response', async () => {
    for (const status of [400, 403, 500]) {
      upload.mockResolvedValue({ status });
      await expect(uploadToStorage('https://signed', file)).rejects.toThrow(
        String(status),
      );
    }
  });
});
