// submitFeedback (issue #257): signed upload URL -> PUT -> POST; a failed
// screenshot upload still sends the note; a failed POST rejects; a retry does
// not upload the screenshot twice. Mocked API and storage, no network.

jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: jest.fn(),
}));
jest.mock('@/services/api.service', () => ({
  apiService: { post: jest.fn() },
}));
jest.mock('@/config/env', () => ({ APP_ENV: 'development' }));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uploadAsync } from 'expo-file-system/legacy';
import { submitFeedback, type UploadCache } from '../useFeedback';
import { apiService } from '@/services/api.service';

const post = (
  apiService as unknown as {
    post: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  }
).post;
const upload = uploadAsync as unknown as jest.Mock<
  (...a: unknown[]) => Promise<{ status: number }>
>;

const input = {
  kind: 'bug' as const,
  message: '  It broke  ',
  route: '/(tabs)/home',
  screenshotUri: 'file:///shot.jpg' as string | null,
};

/** Route the two endpoints. */
function routePosts(
  opts: { urlFails?: boolean; feedbackFails?: unknown } = {},
) {
  post.mockImplementation(async (...args: unknown[]) => {
    const endpoint = args[0] as string;
    if (endpoint === '/feedback/screenshot-url') {
      if (opts.urlFails) throw { status: 500 };
      return {
        success: true,
        data: {
          uploadUrl: 'https://signed/put',
          storagePath: 'users/u1/feedback/abc_feedback.jpg',
        },
      };
    }
    if (opts.feedbackFails) throw opts.feedbackFails;
    return { success: true, data: { id: 'fb1' } };
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  upload.mockResolvedValue({ status: 200 });
});

describe('submitFeedback', () => {
  it('uploads the screenshot, then posts the note with its path and device info', async () => {
    routePosts();
    const id = await submitFeedback(input);
    expect(id).toBe('fb1');
    expect(post.mock.calls[0]).toEqual([
      '/feedback/screenshot-url',
      { fileName: 'feedback.jpg', contentType: 'image/jpeg' },
    ]);
    expect(upload).toHaveBeenCalledWith(
      'https://signed/put',
      'file:///shot.jpg',
      expect.objectContaining({ httpMethod: 'PUT' }),
    );
    const [endpoint, body] = post.mock.calls[1] as [
      string,
      Record<string, unknown>,
    ];
    expect(endpoint).toBe('/feedback');
    expect(body).toMatchObject({
      kind: 'bug',
      message: 'It broke',
      route: '/(tabs)/home',
      screenshotPath: 'users/u1/feedback/abc_feedback.jpg',
      appEnv: 'development',
    });
    expect(typeof body.appVersion).toBe('string');
    expect(typeof body.platform).toBe('string');
    expect(typeof body.osVersion).toBe('string');
  });

  it('sends without an image when there is no screenshot', async () => {
    routePosts();
    await submitFeedback({ ...input, screenshotUri: null });
    expect(post).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect(post.mock.calls[0][1]).not.toHaveProperty('screenshotPath');
  });

  it('still posts the note when the upload URL request fails', async () => {
    routePosts({ urlFails: true });
    await expect(submitFeedback(input)).resolves.toBe('fb1');
    expect(post.mock.calls[1][1]).not.toHaveProperty('screenshotPath');
  });

  it('still posts the note when the PUT fails', async () => {
    routePosts();
    upload.mockResolvedValue({ status: 403 });
    await expect(submitFeedback(input)).resolves.toBe('fb1');
    expect(post.mock.calls[1][1]).not.toHaveProperty('screenshotPath');
  });

  it('rejects with the API error when the note itself fails', async () => {
    routePosts({ feedbackFails: { status: 429 } });
    await expect(
      submitFeedback({ ...input, screenshotUri: null }),
    ).rejects.toEqual({ status: 429 });
  });

  it('a retry reuses the uploaded screenshot instead of uploading again', async () => {
    const cache: { current: UploadCache | null } = { current: null };
    routePosts({ feedbackFails: { status: 500 } });
    await expect(submitFeedback(input, cache)).rejects.toBeDefined();
    expect(cache.current?.storagePath).toBe(
      'users/u1/feedback/abc_feedback.jpg',
    );

    post.mockClear();
    routePosts();
    upload.mockClear();
    await submitFeedback(input, cache);
    expect(upload).not.toHaveBeenCalled();
    expect(
      post.mock.calls.some((c) => c[0] === '/feedback/screenshot-url'),
    ).toBe(false);
    expect(post.mock.calls[0][1]).toMatchObject({
      screenshotPath: 'users/u1/feedback/abc_feedback.jpg',
    });
  });
});
