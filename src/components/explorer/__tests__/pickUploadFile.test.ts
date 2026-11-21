// ─────────────────────────────────────────────────────────────────────────────
// japa#420: picking a document from the photo library, the camera or Files.
// The pickers, the image manipulator and the file system are mocked; these
// tests pin the contract the screens rely on: photos come back as
// `photo-YYYY-MM-DD-HHmmss.jpg`, `image/jpeg` with a size, resized to at most
// 3000 px and saved as JPEG 0.8; Files picks pass through unchanged; cancel
// returns `cancelled`; camera denied / unavailable return their own results.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockLibrary = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockCamera = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockCameraPerm = jest.fn<() => Promise<unknown>>();
const mockLibraryPerm = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a),
  requestCameraPermissionsAsync: () => mockCameraPerm(),
  requestMediaLibraryPermissionsAsync: () => mockLibraryPerm(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

const mockGetDocument = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockGetDocument(...a),
}));

// The manipulator context: records resize calls, renders an image ref that
// saves to a fixed JPEG uri. Every native object's `release` is recorded as
// 'ctx' (a manipulator context) or 'image' (a rendered image), so the tests
// can check nothing is left holding a bitmap (japa#420 review).
const mockRelease = jest.fn<(what: 'ctx' | 'image') => void>();
const mockResize = jest.fn();
const mockSave = jest.fn<(o: unknown) => Promise<unknown>>();
const mockManipulate = jest.fn();
let mockRendered = { width: 3000, height: 2250 };
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (...a: unknown[]) => {
      mockManipulate(...a);
      const ctx = {
        resize: (r: unknown) => {
          mockResize(r);
          return ctx;
        },
        renderAsync: async () => ({
          ...mockRendered,
          saveAsync: (o: unknown) => mockSave(o),
          release: () => mockRelease('image'),
        }),
        release: () => mockRelease('ctx'),
      };
      return ctx;
    },
  },
}));

const mockGetInfo = jest.fn<(uri: string) => Promise<unknown>>();
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (uri: string) => mockGetInfo(uri),
}));

const mockOpenSettings = jest.fn<() => Promise<void>>();
jest.mock('react-native', () => ({
  Linking: { openSettings: () => mockOpenSettings() },
}));

import {
  CAMERA_DENIED_ACTION,
  CAMERA_DENIED_COPY,
  CAMERA_UNAVAILABLE_COPY,
  PHOTO_MAX_SIDE,
  photoFileName,
  photoResize,
  pickResultCopy,
  pickUploadFile,
  uploadErrorAction,
} from '../pickUploadFile';
import { WRONG_TYPE_COPY, pickedFileProblem } from '../uploadLimits';

// 20 Nov 2026, 14:32:05 local time.
const NOW = new Date(2026, 10, 20, 14, 32, 5);
const now = () => NOW;

beforeEach(() => {
  jest.clearAllMocks();
  mockRendered = { width: 3000, height: 2250 };
  mockSave.mockResolvedValue({
    uri: 'file:///cache/converted.jpg',
    width: 3000,
    height: 2250,
  });
  mockGetInfo.mockResolvedValue({ exists: true, size: 2_400_000 });
  mockOpenSettings.mockResolvedValue(undefined);
});

// ── Names and resize ─────────────────────────────────────────────────────────
describe('photoFileName', () => {
  it('is photo-YYYY-MM-DD-HHmmss.jpg in local time', () => {
    expect(photoFileName(NOW)).toBe('photo-2026-11-20-143205.jpg');
  });
  it('pads single digits', () => {
    expect(photoFileName(new Date(2027, 0, 3, 4, 5, 6))).toBe(
      'photo-2027-01-03-040506.jpg',
    );
  });
});

describe('photoResize', () => {
  it('scales the longest side down to 3000', () => {
    expect(photoResize(8064, 6048)).toEqual({ width: PHOTO_MAX_SIDE });
    expect(photoResize(6048, 8064)).toEqual({ height: PHOTO_MAX_SIDE });
  });
  it('leaves a photo that fits, or of unknown size, alone', () => {
    expect(photoResize(3000, 2000)).toBeNull();
    expect(photoResize(1200, 1600)).toBeNull();
    expect(photoResize(0, 0)).toBeNull();
  });
});

// ── Photo library ────────────────────────────────────────────────────────────
describe('pickUploadFile("library")', () => {
  it('converts a HEIC photo to a resized JPEG named photo-….jpg with a size', async () => {
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picker/IMG_1234.HEIC',
          fileName: 'IMG_1234.HEIC',
          mimeType: 'image/heic',
          width: 8064,
          height: 6048,
        },
      ],
    });
    const r = await pickUploadFile('library', now);
    expect(r).toEqual({
      kind: 'picked',
      file: {
        uri: 'file:///cache/converted.jpg',
        name: 'photo-2026-11-20-143205.jpg',
        contentType: 'image/jpeg',
        size: 2_400_000,
      },
    });
    // Resized on the longest side, saved as JPEG 0.8.
    expect(mockManipulate).toHaveBeenCalledWith('file:///picker/IMG_1234.HEIC');
    expect(mockResize).toHaveBeenCalledWith({ width: 3000 });
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    // And it passes the japa#310 checks the screens run next.
    if (r.kind === 'picked') expect(pickedFileProblem(r.file)).toBeNull();
  });

  it('opens the system picker for one image, no video, no editing', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: null });
    await pickUploadFile('library', now);
    expect(mockLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 0.8,
        preferredAssetRepresentationMode: 'compatible',
      }),
    );
    // PHPicker needs no permission: the app never asks for the library.
    expect(mockLibraryPerm).not.toHaveBeenCalled();
  });

  it('does not resize a photo that already fits', async () => {
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 1200, height: 1600 }],
    });
    await pickUploadFile('library', now);
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it('checks the rendered size when the picker gave none', async () => {
    mockRendered = { width: 4000, height: 6000 };
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg' }],
    });
    await pickUploadFile('library', now);
    expect(mockResize).toHaveBeenCalledWith({ height: 3000 });
  });

  // ── Native memory (japa#420 review): every context and image released ──
  it('releases the context and the image after a successful save', async () => {
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 8064, height: 6048 }],
    });
    await pickUploadFile('library', now);
    // One context, one rendered image: each released exactly once.
    expect(mockRelease.mock.calls.map((c) => c[0]).sort()).toEqual([
      'ctx',
      'image',
    ]);
  });

  it('a failed save still releases the image, and the error goes up', async () => {
    mockSave.mockRejectedValue(new Error('disk full'));
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 8064, height: 6048 }],
    });
    await expect(pickUploadFile('library', now)).rejects.toThrow('disk full');
    expect(mockRelease).toHaveBeenCalledWith('ctx');
    expect(mockRelease).toHaveBeenCalledWith('image');
    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  it('the two-pass path releases both contexts and both images', async () => {
    // No size from the picker and a large render: a second resize pass.
    mockRendered = { width: 4000, height: 6000 };
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg' }],
    });
    await pickUploadFile('library', now);
    expect(mockRelease.mock.calls.map((c) => c[0]).sort()).toEqual([
      'ctx',
      'ctx',
      'image',
      'image',
    ]);
  });

  it('cancel returns cancelled and converts nothing', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickUploadFile('library', now)).toEqual({ kind: 'cancelled' });
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('an unknown converted size is null (the backend checks anyway)', async () => {
    mockGetInfo.mockRejectedValue(new Error('nope'));
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 10, height: 10 }],
    });
    const r = await pickUploadFile('library', now);
    expect(r.kind === 'picked' && r.file.size).toBeNull();
  });
});

// ── Camera ───────────────────────────────────────────────────────────────────
describe('pickUploadFile("camera")', () => {
  it('asks for permission, then opens the camera and converts the photo', async () => {
    mockCameraPerm.mockResolvedValue({ granted: true });
    mockCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cam.jpg', width: 4032, height: 3024 }],
    });
    const r = await pickUploadFile('camera', now);
    expect(mockCameraPerm).toHaveBeenCalledTimes(1);
    expect(mockCamera).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'] }),
    );
    expect(r).toEqual({
      kind: 'picked',
      file: expect.objectContaining({
        name: 'photo-2026-11-20-143205.jpg',
        contentType: 'image/jpeg',
        size: 2_400_000,
      }),
    });
  });

  it('permission denied returns cameraDenied and never opens the camera', async () => {
    mockCameraPerm.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const r = await pickUploadFile('camera', now);
    expect(r).toEqual({ kind: 'cameraDenied' });
    expect(mockCamera).not.toHaveBeenCalled();
    expect(pickResultCopy(r)).toBe(CAMERA_DENIED_COPY);
  });

  it('a camera that cannot open returns cameraUnavailable (no throw)', async () => {
    mockCameraPerm.mockResolvedValue({ granted: true });
    mockCamera.mockRejectedValue(new Error('Camera not available'));
    const r = await pickUploadFile('camera', now);
    expect(r).toEqual({ kind: 'cameraUnavailable' });
    expect(pickResultCopy(r)).toBe(CAMERA_UNAVAILABLE_COPY);
  });

  it('cancel inside the camera returns cancelled', async () => {
    mockCameraPerm.mockResolvedValue({ granted: true });
    mockCamera.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickUploadFile('camera', now)).toEqual({ kind: 'cancelled' });
  });
});

// ── Files ────────────────────────────────────────────────────────────────────
describe('pickUploadFile("files")', () => {
  it('uses the same document picker and passes the file through unchanged', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/passport.pdf',
          name: 'passport.pdf',
          mimeType: 'application/pdf',
          size: 512_000,
        },
      ],
    });
    const r = await pickUploadFile('files', now);
    expect(mockGetDocument).toHaveBeenCalledWith({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    expect(r).toEqual({
      kind: 'picked',
      file: {
        uri: 'file:///cache/passport.pdf',
        name: 'passport.pdf',
        contentType: 'application/pdf',
        size: 512_000,
      },
    });
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('does not convert a HEIC from Files: the japa#310 check refuses it', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/IMG_1.HEIC',
          name: 'IMG_1.HEIC',
          mimeType: 'image/heic',
          size: 1000,
        },
      ],
    });
    const r = await pickUploadFile('files', now);
    expect(mockManipulate).not.toHaveBeenCalled();
    expect(r.kind === 'picked' && pickedFileProblem(r.file)).toBe(
      WRONG_TYPE_COPY,
    );
  });

  it('cancel returns cancelled', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickUploadFile('files', now)).toEqual({ kind: 'cancelled' });
  });
});

// ── Lines and the Open Settings action ───────────────────────────────────────
describe('pickResultCopy / uploadErrorAction', () => {
  it('no line for a pick or a cancel', () => {
    expect(pickResultCopy({ kind: 'cancelled' })).toBeNull();
  });
  it('only the camera-denied line gets "Open Settings"', () => {
    const a = uploadErrorAction(CAMERA_DENIED_COPY);
    expect(a?.label).toBe(CAMERA_DENIED_ACTION);
    a?.onPress();
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(uploadErrorAction(CAMERA_UNAVAILABLE_COPY)).toBeUndefined();
    expect(uploadErrorAction(WRONG_TYPE_COPY)).toBeUndefined();
    expect(uploadErrorAction(null)).toBeUndefined();
  });
});
