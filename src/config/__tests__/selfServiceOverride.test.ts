// ─────────────────────────────────────────────────────────────────────────────
// Development-only override of the self-service-only flag (japa#375).
//
// Covers: the pure rules (parse, plan, link), the override on / off /
// cleared in development through the single read point `isSelfServiceOnly()`,
// the link handler's accepted and rejected values, no reload when the value
// already applies, the dev menu entry — and, the point of the issue, that
// with `__DEV__` false a stored override has no effect, the link is ignored
// and the menu entry is not registered.
// ─────────────────────────────────────────────────────────────────────────────
// `require` is needed: jest.isolateModules reloads the modules per "app
// start", which a static import cannot do.
/* eslint-disable @typescript-eslint/no-require-imports */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// ── Mocks ───────────────────────────────────────────────────────────────────
// In-memory AsyncStorage (no native module in jest).
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mockStore.delete(k);
    }),
  },
}));

// The value baked into the build (expo `extra.selfServiceOnly`), set per test
// before the modules are (re)loaded.
let mockBaked: boolean | undefined = false;
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: { selfServiceOnly: mockBaked } };
    },
  },
}));

// DevSettings.reload (react-native's `DevSettings` getter requires this file).
const mockReload = jest.fn();
jest.mock('react-native/Libraries/Utilities/DevSettings', () => ({
  __esModule: true,
  default: { reload: () => mockReload(), addMenuItem: jest.fn() },
}));

// Dev menu + router, for the menu-entry tests.
const mockRegister = jest.fn();
jest.mock('expo-dev-menu', () => ({
  registerDevMenuItems: (...args: unknown[]) => mockRegister(...args),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const KEY = 'dev.selfServiceOnlyOverride';
const g = globalThis as unknown as { __DEV__: boolean };
const realDev = g.__DEV__;

type Mods = {
  env: typeof import('@/config/env');
  override: typeof import('@/config/selfServiceOverride');
  store: typeof import('@/config/selfServiceOverrideStore');
  menu: typeof import('@/utils/dev-menu');
  reload: jest.Mock;
};

/** Fresh copies of the modules (module state reset), as on an app start. */
function load(): Mods {
  let mods!: Mods;
  jest.isolateModules(() => {
    // One reload count per "app start".
    mockReload.mockClear();
    const reload = mockReload;
    mods = {
      env: require('@/config/env'),
      override: require('@/config/selfServiceOverride'),
      store: require('@/config/selfServiceOverrideStore'),
      menu: require('@/utils/dev-menu'),
      reload,
    };
  });
  return mods;
}

beforeEach(() => {
  mockStore.clear();
  mockBaked = false;
  mockRegister.mockClear();
  g.__DEV__ = true;
});
afterEach(() => {
  g.__DEV__ = realDev;
});

// ── Pure rules ──────────────────────────────────────────────────────────────
describe('pure rules', () => {
  const o = () => load().override;

  it('resolves the override over the baked value, else the baked value', () => {
    const { resolveSelfServiceOnly } = o();
    expect(resolveSelfServiceOnly(false, undefined)).toBe(false);
    expect(resolveSelfServiceOnly(true, undefined)).toBe(true);
    expect(resolveSelfServiceOnly(false, true)).toBe(true);
    expect(resolveSelfServiceOnly(true, false)).toBe(false);
  });

  it('reads only "on" / "off" from storage; anything else is no override', () => {
    const { parseStoredOverride } = o();
    expect(parseStoredOverride('on')).toBe(true);
    expect(parseStoredOverride('off')).toBe(false);
    for (const raw of [null, undefined, '', 'true', 'ON', 'build'])
      expect(parseStoredOverride(raw)).toBeUndefined();
  });

  it('plans a reload only when the effective value changes', () => {
    const { planSelfServiceChange: plan } = o();
    // Build off, no override → on: store + reload.
    expect(plan('on', false, undefined)).toEqual({
      nextOverride: true,
      write: true,
      reload: true,
    });
    // Already on by override → on: nothing to do (no reload loop).
    expect(plan('on', false, true)).toEqual({
      nextOverride: true,
      write: false,
      reload: false,
    });
    // Build on, no override → on: stored as an override, no reload.
    expect(plan('on', true, undefined)).toEqual({
      nextOverride: true,
      write: true,
      reload: false,
    });
    // Clear an override that differs from the build: remove + reload.
    expect(plan('build', false, true)).toEqual({
      nextOverride: undefined,
      write: true,
      reload: true,
    });
    // Nothing stored → build: nothing to do.
    expect(plan('build', true, undefined)).toEqual({
      nextOverride: undefined,
      write: false,
      reload: false,
    });
  });
});

// ── The link parser: accepted and rejected values ───────────────────────────
describe('parseSelfServiceLink (development)', () => {
  it.each([
    ['durintech://dev/self-service-only?value=on', 'on'],
    ['durintech://dev/self-service-only?value=off', 'off'],
    ['durintech://dev/self-service-only?value=build', 'build'],
    ['durintech://dev/self-service-only/?value=OFF', 'off'],
    ['/dev/self-service-only?value=on', 'on'],
    ['dev/self-service-only?x=1&value=build#y', 'build'],
  ])('accepts %s', (path, request) => {
    expect(load().override.parseSelfServiceLink(path)).toEqual({ request });
  });

  it.each([
    'durintech://dev/self-service-only',
    'durintech://dev/self-service-only?value=',
    'durintech://dev/self-service-only?value=true',
    'durintech://dev/self-service-only?value=1',
    'durintech://dev/self-service-only?value=%E0%A4%A',
  ])('consumes but rejects the value of %s', (path) => {
    expect(load().override.parseSelfServiceLink(path)).toEqual({
      request: null,
    });
  });

  it.each([
    'durintech://messages/abc',
    'durintech://home',
    '/dev-config',
    'durintech://dev/other?value=on',
    'durintech://dev/self-service-only-x?value=on',
    'https://seli.app/dev/self-service-only/extra?value=on',
  ])('leaves other links alone: %s', (path) => {
    expect(load().override.parseSelfServiceLink(path)).toBeNull();
  });
});

// ── Development: override on / off / cleared via isSelfServiceOnly() ────────
describe('in development (__DEV__ true)', () => {
  it('with nothing stored behaves exactly as the build', async () => {
    for (const baked of [false, true]) {
      mockStore.clear();
      mockBaked = baked;
      const m = load();
      await m.store.loadSelfServiceOverride();
      expect(m.env.isSelfServiceOnly()).toBe(baked);
      expect(
        m.override.selfServiceOnlySource(m.override.getSelfServiceOverride()),
      ).toBe('build');
    }
  });

  it('a stored override wins after loading at startup (survives restart)', async () => {
    mockStore.set(KEY, 'on');
    const m = load();
    await m.store.loadSelfServiceOverride();
    expect(m.env.isSelfServiceOnly()).toBe(true);

    mockBaked = true;
    mockStore.set(KEY, 'off');
    const m2 = load();
    await m2.store.loadSelfServiceOverride();
    expect(m2.env.isSelfServiceOnly()).toBe(false);
  });

  it('on / off / build write storage, switch the value and reload', async () => {
    const m = load();
    await m.store.loadSelfServiceOverride();

    await expect(m.store.applySelfServiceRequest('on')).resolves.toBe(true);
    expect(mockStore.get(KEY)).toBe('on');
    expect(m.env.isSelfServiceOnly()).toBe(true);
    expect(m.reload).toHaveBeenCalledTimes(1);

    await m.store.applySelfServiceRequest('off');
    expect(mockStore.get(KEY)).toBe('off');
    expect(m.env.isSelfServiceOnly()).toBe(false);
    // It was on, so turning it off changes the effective value: reload.
    expect(m.reload).toHaveBeenCalledTimes(2);

    // Clearing an "off" override on an "off" build: key removed, no reload.
    await expect(m.store.applySelfServiceRequest('build')).resolves.toBe(false);
    expect(mockStore.has(KEY)).toBe(false);
    expect(m.env.isSelfServiceOnly()).toBe(false);
    expect(m.reload).toHaveBeenCalledTimes(2);

    // The stored choice is what the next app start reads.
    await m.store.applySelfServiceRequest('on');
    const next = load();
    await next.store.loadSelfServiceOverride();
    expect(next.env.isSelfServiceOnly()).toBe(true);
  });

  it('the link sets the value and lands on Home, cold or warm, with no reload loop', async () => {
    // Cold start: the link arrives before the root layout loaded the override.
    const cold = load();
    await expect(
      cold.store.handleSelfServiceLink(
        'durintech://dev/self-service-only?value=on',
      ),
    ).resolves.toBe('/home');
    expect(cold.env.isSelfServiceOnly()).toBe(true);
    expect(cold.reload).toHaveBeenCalledTimes(1);

    // After the reload the same initial URL may be delivered again: value
    // already applies → Home, no second reload.
    const again = load();
    await expect(
      again.store.handleSelfServiceLink(
        'durintech://dev/self-service-only?value=on',
      ),
    ).resolves.toBe('/home');
    expect(again.reload).not.toHaveBeenCalled();
    expect(again.env.isSelfServiceOnly()).toBe(true);

    // Warm app (already loaded): same result.
    await again.store.handleSelfServiceLink(
      'durintech://dev/self-service-only?value=build',
    );
    expect(again.env.isSelfServiceOnly()).toBe(false);
    expect(mockStore.has(KEY)).toBe(false);
    expect(again.reload).toHaveBeenCalledTimes(1);
  });

  it('a rejected value changes nothing but lands on Home', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const m = load();
    expect(
      m.store.handleSelfServiceLink(
        'durintech://dev/self-service-only?value=yes',
      ),
    ).toBe('/home');
    expect(mockStore.size).toBe(0);
    expect(m.reload).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('the +native-intent hook routes the dev link through the handler', async () => {
    let hook!: typeof import('@/app/+native-intent');
    jest.isolateModules(() => {
      hook = require('@/app/+native-intent');
    });
    await expect(
      hook.redirectSystemPath({
        path: 'durintech://dev/self-service-only?value=on',
        initial: true,
      }),
    ).resolves.toBe('/home');
    expect(
      hook.redirectSystemPath({ path: 'durintech://home', initial: false }),
    ).toBe('durintech://home');
  });

  it('every other link passes through unchanged', () => {
    const m = load();
    expect(m.store.handleSelfServiceLink('durintech://messages/abc')).toBe(
      'durintech://messages/abc',
    );
  });

  it('registers the dev menu entry with the effective value and source', async () => {
    mockStore.set(KEY, 'on');
    const m = load();
    await m.store.loadSelfServiceOverride();
    m.menu.registerDevMenu();
    const items = mockRegister.mock.calls[0][0] as {
      name: string;
      callback: () => void;
    }[];
    const names = items.map((i) => i.name);
    expect(names).toContain('Self-service only: ON (override) - turn off');
    expect(names).toContain("Self-service only: use the build's value");

    // The flip item turns it off (and reloads).
    items.find((i) => i.name.startsWith('Self-service only: ON'))!.callback();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockStore.get(KEY)).toBe('off');
    expect(m.reload).toHaveBeenCalled();
  });

  it('labels the build value when there is no override', () => {
    expect(load().menu.selfServiceMenuLabel(false, 'build')).toBe(
      'Self-service only: OFF (build) - turn on',
    );
  });
});

// ── Production guarantee (__DEV__ false) ────────────────────────────────────
describe('outside development (__DEV__ false)', () => {
  beforeEach(() => {
    g.__DEV__ = false;
  });

  it('a stored override has no effect: the baked value is returned', async () => {
    for (const baked of [true, false]) {
      mockBaked = baked;
      // Try to flip it with a stored override the other way.
      mockStore.set(KEY, baked ? 'off' : 'on');
      const m = load();
      await m.store.loadSelfServiceOverride();
      // Even a direct in-memory write is refused.
      m.override.setLoadedSelfServiceOverride(!baked);
      expect(m.override.getSelfServiceOverride()).toBeUndefined();
      expect(m.env.isSelfServiceOnly()).toBe(baked);
    }
  });

  it('never reads or writes storage and never reloads', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage')
      .default as {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
    };
    AsyncStorage.getItem.mockClear();
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
    mockBaked = true;
    const m = load();
    await m.store.loadSelfServiceOverride();
    await expect(m.store.applySelfServiceRequest('off')).resolves.toBe(false);
    // Only OUR key matters (the settings store hydrates its own key).
    const touched = (fn: jest.Mock) =>
      fn.mock.calls.some((call) => call[0] === KEY);
    expect(touched(AsyncStorage.getItem)).toBe(false);
    expect(touched(AsyncStorage.setItem)).toBe(false);
    expect(touched(AsyncStorage.removeItem)).toBe(false);
    expect(m.reload).not.toHaveBeenCalled();
    expect(m.env.isSelfServiceOnly()).toBe(true);
  });

  it('ignores the link: it passes through unchanged (an unknown route)', () => {
    mockBaked = true;
    const m = load();
    for (const v of ['on', 'off', 'build']) {
      const link = `durintech://dev/self-service-only?value=${v}`;
      expect(m.override.parseSelfServiceLink(link)).toBeNull();
      expect(m.store.handleSelfServiceLink(link)).toBe(link);
    }
    expect(mockStore.size).toBe(0);
    expect(m.reload).not.toHaveBeenCalled();
    expect(m.env.isSelfServiceOnly()).toBe(true);
  });

  it('does not register the dev menu entry', () => {
    load().menu.registerDevMenu();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
