// Capture gives up after the timeout so the button cannot stay hidden (#257).
jest.mock('react-native-view-shot', () => ({
  captureScreen: () => new Promise(() => {}), // never resolves
}));
import { describe, expect, it, jest } from '@jest/globals';
import { captureCurrentScreen } from '../captureScreen';

describe('captureCurrentScreen', () => {
  it('resolves null when the capture hangs', async () => {
    await expect(captureCurrentScreen(50)).resolves.toBeNull();
  });
});
