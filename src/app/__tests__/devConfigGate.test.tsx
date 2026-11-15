// ─────────────────────────────────────────────────────────────────────────────
// App configuration dev screen gate (japa#330, fixed in the japa#375 review).
//
// The screen is a dev tool: it must open only in a development (`__DEV__`)
// build. It used to gate on IS_PROD, so a TestFlight build (`tester`
// profile, APP_ENV=staging) opened it from `durintech://dev-config`. Outside
// development it renders nothing, goes back and never reads the config.
// ─────────────────────────────────────────────────────────────────────────────
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// The live collector reads native modules (Firebase, expo-updates): stub it
// and count calls, so the test can prove a blocked screen reads nothing.
const mockCollect = jest.fn(() => new Promise(() => {}));
jest.mock('@/config/devConfigCollect', () => ({
  collectDevConfigSources: () => mockCollect(),
}));

import React from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import DevConfigScreen from '../dev-config';

const g = globalThis as unknown as { __DEV__: boolean };
const realDev = g.__DEV__;

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DevConfigScreen />);
  });
  const json = tree.toJSON();
  act(() => tree.unmount());
  return json;
}

afterEach(() => {
  g.__DEV__ = realDev;
  mockBack.mockClear();
  mockCollect.mockClear();
});

describe('dev-config screen gate', () => {
  it('outside a development build (e.g. TestFlight): renders nothing and goes back', () => {
    g.__DEV__ = false;
    expect(render()).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockCollect).not.toHaveBeenCalled();
  });

  it('in a development build: renders and loads the configuration', () => {
    g.__DEV__ = true;
    expect(render()).not.toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockCollect).toHaveBeenCalledTimes(1);
  });
});
