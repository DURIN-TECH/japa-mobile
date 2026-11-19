// ─────────────────────────────────────────────────────────────────────────────
// Development-only override of the self-service-only flag (japa#375).
//
// Covers: the pure rules (parse, plan, link), the override on / off /
// cleared in development through the single read point `isSelfServiceOnly()`,
// the link handler's accepted and rejected values, no reload when the value
// already applies, the stale link the native side re-delivers after a reload
// (review round 1), the startup read timeout, the dev menu entry — and, the
// point of the issue, that with `__DEV__` false a stored override has no
// effect, the link is ignored and the menu entry is not registered.
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

// expo-linking's native memory of the last link (see the stale-link notes in
// selfServiceOverrideStore.ts): set by every received link, survives a JS
// reload, cleared by clearInitialURL().
let mockNativeUrl: string | null = null;
jest.mock('expo-linking', () => ({
  getLinkingURL: () => mockNativeUrl,
  clearInitialURL: () => {
    mockNativeUrl = null;
  },
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
  intent: typeof import('@/app/+native-intent');
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
      intent: require('@/app/+native-intent'),
      reload,
    };
  });
  return mods;
}

// ── Simulated app lifecycle (what expo-router hands +native-intent) ─────────
type Platform = 'ios' | 'android';
// Android: React Native's initial URL (the launching intent) is NOT cleared
// by clearInitialURL and survives a JS reload. Worst case modelled: it holds
// the last link received.
let mockAndroidIntent: string | null = null;

const link = (v: string) => `durintech://dev/self-service-only?value=${v}`;

/** The initial URL expo-router would deliver on this JS start, if any. */
function initialUrl(platform: Platform): string | null {
  // iOS: expo-router reads expo-linking's getLinkingURL().
  // Android: expo-router reads React Native's initial URL (the intent).
  return platform === 'ios' ? mockNativeUrl : mockAndroidIntent;
}

/** A JS start (cold launch or reload): deliver the initial URL, then load. */
async function start(platform: Platform): Promise<Mods> {
  const m = load();
  const url = initialUrl(platform);
  if (url) await m.intent.redirectSystemPath({ path: url, initial: true });
  await m.store.loadSelfServiceOverride(); // the root layout's gate
  return m;
}

/** New process launched by `url` (or plainly): native memory starts fresh. */
function coldStart(platform: Platform, url: string | null = null) {
  mockNativeUrl = url;
  mockAndroidIntent = url;
  return start(platform);
}

/** JS reload in the same process (DevSettings.reload / Metro "r"). */
const reload = (platform: Platform) => start(platform);

/** A link opened while the app runs. */
async function openWarm(m: Mods, url: string) {
  mockNativeUrl = url; // expo-linking records every received link
  mockAndroidIntent = url;
  await m.intent.redirectSystemPath({ path: url, initial: false });
}

/** Tap a dev menu item by name and let its async work finish. */
async function tapMenu(m: Mods, name: string) {
  mockRegister.mockClear();
  m.menu.registerDevMenu();
  const items = mockRegister.mock.calls[0][0] as {
    name: string;
    callback: () => void;
  }[];
  items.find((i) => i.name === name)!.callback();
  await new Promise((r) => setTimeout(r, 0));
}
const TOGGLE = 'Self-service only: toggle on/off';
const USE_BUILD = "Self-service only: use the build's value";

beforeEach(() => {
  mockStore.clear();
  mockBaked = false;
  mockRegister.mockClear();
  mockNativeUrl = null;
  mockAndroidIntent = null;
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
    // Cold launch by the link: expo-linking holds it natively.
    mockNativeUrl = 'durintech://dev/self-service-only?value=on';
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

  it('registers state-free menu entries; toggle flips the current value', async () => {
    mockStore.set(KEY, 'on');
    const m = await coldStart('ios');
    m.menu.registerDevMenu();
    const names = (mockRegister.mock.calls[0][0] as { name: string }[]).map(
      (i) => i.name,
    );
    expect(names).toEqual(expect.arrayContaining([TOGGLE, USE_BUILD]));

    // Toggle reads the value when tapped: on → off (reload), off → on.
    await tapMenu(m, TOGGLE);
    expect(mockStore.get(KEY)).toBe('off');
    expect(m.reload).toHaveBeenCalledTimes(1);
    await tapMenu(m, TOGGLE);
    expect(mockStore.get(KEY)).toBe('on');
  });

  it('menu callbacks swallow a synchronous throw and a rejection', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { runSelfServiceRequest } = load().menu;
    expect(() =>
      runSelfServiceRequest(() => {
        throw new Error('storage exploded');
      }),
    ).not.toThrow();
    runSelfServiceRequest(() => Promise.reject(new Error('write failed')));
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a storage read that never settles falls back to no override', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const AsyncStorage = require('@react-native-async-storage/async-storage')
      .default as { getItem: jest.Mock };
    AsyncStorage.getItem.mockImplementationOnce(() => new Promise(() => {}));
    mockBaked = true;
    const m = load();
    const done = m.store.loadSelfServiceOverride();
    jest.advanceTimersByTime(m.store.LOAD_TIMEOUT_MS);
    await done;
    expect(m.override.getSelfServiceOverride()).toBeUndefined();
    expect(m.env.isSelfServiceOnly()).toBe(true);
    warn.mockRestore();
    jest.useRealTimers();
  });

  it('useSelfServiceOverrideLoaded is false until the read finishes', async () => {
    const seen = await renderLoadedHook();
    expect(seen[0]).toBe(false);
    expect(seen[seen.length - 1]).toBe(true);
  });
});

// ── Stale link re-delivered after a reload (review round 1) ─────────────────
// The native side remembers the last link across a JS reload. A dev link
// must be applied exactly once, and opening it again later — same or other
// value, warm or cold — must still work.
describe.each<Platform>(['ios', 'android'])(
  'stale dev link after a reload (%s)',
  (platform) => {
    it('link on → menu off → reload: stays off', async () => {
      const a = await coldStart(platform, link('on'));
      expect(a.env.isSelfServiceOnly()).toBe(true);
      const b = await reload(platform); // the reload the link caused
      expect(b.env.isSelfServiceOnly()).toBe(true);
      expect(b.reload).not.toHaveBeenCalled();

      await tapMenu(b, TOGGLE);
      expect(b.reload).toHaveBeenCalledTimes(1);
      const c = await reload(platform);
      expect(c.env.isSelfServiceOnly()).toBe(false);
      expect(mockStore.get(KEY)).toBe('off');
      expect(c.reload).not.toHaveBeenCalled();
    });

    it("link on → use the build's value → reload: stays on the build", async () => {
      const a = await coldStart(platform);
      await openWarm(a, link('on'));
      expect(a.reload).toHaveBeenCalledTimes(1);
      const b = await reload(platform);
      expect(b.env.isSelfServiceOnly()).toBe(true);

      await tapMenu(b, USE_BUILD);
      const c = await reload(platform);
      expect(mockStore.has(KEY)).toBe(false);
      expect(c.env.isSelfServiceOnly()).toBe(false);
      expect(
        c.override.selfServiceOnlySource(c.override.getSelfServiceOverride()),
      ).toBe('build');
      expect(c.reload).not.toHaveBeenCalled();
    });

    it('link on → plain reloads: no re-apply, no second reload', async () => {
      const a = await coldStart(platform);
      await openWarm(a, link('on'));
      expect(a.reload).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 3; i++) {
        // Change storage behind its back: a re-applied link would undo this.
        const r = await reload(platform);
        expect(r.reload).not.toHaveBeenCalled();
        expect(r.env.isSelfServiceOnly()).toBe(true);
      }
      // Proof the link is not re-applied: set off by hand, reload, still off.
      mockStore.set(KEY, 'off');
      const r = await reload(platform);
      expect(r.env.isSelfServiceOnly()).toBe(false);
      expect(r.reload).not.toHaveBeenCalled();
    });

    it('link on → link off → link on: each applies (warm)', async () => {
      const a = await coldStart(platform);
      await openWarm(a, link('on'));
      let m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(true);

      await openWarm(m, link('off'));
      expect(m.reload).toHaveBeenCalledTimes(1);
      m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(false);

      await openWarm(m, link('on'));
      expect(m.reload).toHaveBeenCalledTimes(1);
      m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(true);
    });

    it('the same link opened again later still applies, warm or cold', async () => {
      const a = await coldStart(platform, link('on'));
      await tapMenu(a, TOGGLE); // off
      let m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(false);

      // Same value again while running: applies.
      await openWarm(m, link('on'));
      m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(true);

      // Off by menu, then the app is killed and cold-launched by the SAME
      // link: a new process, so it applies.
      await tapMenu(m, TOGGLE);
      m = await reload(platform);
      expect(m.env.isSelfServiceOnly()).toBe(false);
      m = await coldStart(platform, link('on'));
      expect(m.env.isSelfServiceOnly()).toBe(true);
    });
  },
);

/** Renders a probe of useSelfServiceOverrideLoaded; returns every value seen. */
async function renderLoadedHook(): Promise<boolean[]> {
  // React, the renderer and the store must come from ONE module registry,
  // or the hook sees a second copy of React.
  let React!: typeof import('react');
  let TestRenderer!: typeof import('react-test-renderer');
  let store!: typeof import('@/config/selfServiceOverrideStore');
  jest.isolateModules(() => {
    React = require('react');
    TestRenderer = require('react-test-renderer');
    store = require('@/config/selfServiceOverrideStore');
  });
  const seen: boolean[] = [];
  function Probe() {
    seen.push(store.useSelfServiceOverrideLoaded());
    return null;
  }
  let tree!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(React.createElement(Probe));
  });
  await TestRenderer.act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  TestRenderer.act(() => tree.unmount());
  return seen;
}

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

  it('redirectSystemPath passes the dev link and other links through unchanged', () => {
    mockNativeUrl = link('on');
    const m = load();
    for (const path of [link('on'), link('off'), 'durintech://home']) {
      for (const initial of [true, false]) {
        expect(m.intent.redirectSystemPath({ path, initial })).toBe(path);
      }
    }
    expect(mockStore.size).toBe(0);
    expect(m.reload).not.toHaveBeenCalled();
    // The native link memory is left alone too.
    expect(mockNativeUrl).toBe(link('on'));
  });

  it('useSelfServiceOverrideLoaded starts true (nothing to wait for)', async () => {
    const seen = await renderLoadedHook();
    expect(seen[0]).toBe(true);
    expect(seen.every(Boolean)).toBe(true);
  });
});
