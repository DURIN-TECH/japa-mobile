// ─────────────────────────────────────────────────────────────────────────────
// Sign-out teardown in the auth store (issue #263).
//
// Every sign-out path must (1) unregister push BEFORE the Firebase session
// ends where it can, (2) empty the per-user caches (clearUserSession: React
// Query, onboarding store, device keys) and (3) reset every per-user field of
// the store. The paths: logout(), deleteAccount(), and the onAuthStateChanged
// handler (syncAuthUser) seeing a null user or a different uid.
//
// Firebase, the API and the push service are replaced by spies; the call order
// is recorded in `calls` so "unregister before sign-out" can be asserted.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Shared, ordered log of the side effects under test. `mock` prefix lets the
// hoisted jest.mock factories reference it.
const mockCalls: string[] = [];
// When set, the push teardown waits on it: simulates a slow network so a
// second auth event can arrive mid-teardown (review round 1).
const mockGate: { wait: Promise<void> | null } = { wait: null };
// Firebase's live currentUser (authService.getCurrentUser()).
const mockFirebase: { currentUser: { uid: string } | null } = {
  currentUser: null,
};

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('@/services/auth.service', () => ({
  authService: {
    logout: jest.fn(async () => {
      mockCalls.push('signOut');
    }),
    reauthenticate: jest.fn(async () => {}),
    getCurrentUser: () => mockFirebase.currentUser,
    getErrorMessage: () => 'error',
  },
}));
jest.mock('@/services/api.service', () => ({
  apiService: {
    get: jest.fn(async () => ({ success: true, data: null })),
    delete: jest.fn(async () => ({ success: true })),
  },
}));
jest.mock('@/services/push-notification.service', () => ({
  pushNotificationService: {
    unregisterToken: jest.fn(async (opts?: { notifyBackend?: boolean }) => {
      if (mockGate.wait) await mockGate.wait;
      mockCalls.push(
        opts?.notifyBackend === false ? 'unregisterLocal' : 'unregister',
      );
    }),
    initialize: jest.fn(async () => {}),
  },
}));
jest.mock('@/services/session.service', () => ({
  clearUserSession: jest.fn(async () => {
    mockCalls.push('clearUserSession');
  }),
}));
// The drafts store pulls in the encrypted vault (expo-secure-store); only its
// clear/load hooks matter here.
jest.mock('@/stores/answerDrafts.store', () => {
  const state = {
    clearAll: jest.fn(() => {
      mockCalls.push('drafts.clearAll');
    }),
    loadFromVault: jest.fn(async (uid: string) => {
      mockCalls.push(`drafts.load:${uid}`);
    }),
  };
  return { useAnswerDraftsStore: { getState: () => state } };
});

import { useAuthStore, __resetSessionTrackingForTests } from '../auth.store';
import type { FirebaseUser } from '@/services/auth.service';
import type { UserProfile } from '@/types/user.type';

const st = () => useAuthStore.getState();
const fbUser = (uid: string) => ({ uid, email: `${uid}@x` }) as FirebaseUser;
const profileOf = (uid: string) => ({ id: uid }) as unknown as UserProfile;

/** Put the store in "uid is signed in, with a profile and stray phone state". */
async function signIn(uid: string) {
  await st().syncAuthUser(fbUser(uid));
  useAuthStore.setState({
    profile: profileOf(uid),
    phoneNumber: '+234000',
    confirmationResult: {} as never,
    error: 'old error',
  });
  mockCalls.length = 0;
}

/** Every per-user field is empty. */
function expectSignedOutState() {
  const s = st();
  expect(s.user).toBeNull();
  expect(s.profile).toBeNull();
  expect(s.isAuthenticated).toBe(false);
  expect(s.confirmationResult).toBeNull();
  expect(s.phoneNumber).toBeNull();
  expect(s.error).toBeNull();
}

beforeEach(() => {
  __resetSessionTrackingForTests();
  useAuthStore.setState({
    user: null,
    profile: null,
    isAuthenticated: false,
    confirmationResult: null,
    phoneNumber: null,
    error: null,
  });
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockGate.wait = null;
  mockFirebase.currentUser = null;
});

describe('logout()', () => {
  it('unregisters push before signing out, then clears caches and the store', async () => {
    await signIn('A');
    await st().logout();
    expect(mockCalls).toEqual([
      'unregister',
      'signOut',
      'clearUserSession',
      'drafts.clearAll', // #187 subscription still fires
    ]);
    expectSignedOutState();
  });

  it("does not tear down again on the listener's null event that follows", async () => {
    await signIn('A');
    await st().logout();
    mockCalls.length = 0;
    await st().syncAuthUser(null);
    expect(mockCalls).toEqual([]);
    expectSignedOutState();
  });
});

describe('deleteAccount()', () => {
  it('unregisters push, signs out, clears caches and the store', async () => {
    await signIn('A');
    await expect(st().deleteAccount('pw')).resolves.toBe(true);
    expect(mockCalls).toEqual([
      'unregister',
      'signOut',
      'clearUserSession',
      'drafts.clearAll',
    ]);
    expectSignedOutState();
    // The listener's null event afterwards is a no-op.
    mockCalls.length = 0;
    await st().syncAuthUser(null);
    expect(mockCalls).toEqual([]);
  });
});

describe('syncAuthUser() (onAuthStateChanged)', () => {
  it('session ended on its own: unregisters push, clears caches, clears profile too', async () => {
    await signIn('A');
    await st().syncAuthUser(null);
    expect(mockCalls).toEqual([
      'unregisterLocal',
      'clearUserSession',
      'drafts.clearAll',
    ]);
    expectSignedOutState();
  });

  it('cold start signed out: local-only push cleanup and cache clear', async () => {
    await st().syncAuthUser(null);
    expect(mockCalls).toEqual(['unregisterLocal', 'clearUserSession']);
    expectSignedOutState();
  });

  it('uid change without a null in between: tears A down, keeps B signed in', async () => {
    await signIn('A');
    await st().syncAuthUser(fbUser('B'));
    expect(mockCalls).toEqual([
      'unregisterLocal',
      'clearUserSession',
      // Answer drafts: A's forgotten, B's loaded.
      'drafts.clearAll',
      'drafts.load:B',
    ]);
    const s = st();
    expect(s.user?.uid).toBe('B');
    expect(s.isAuthenticated).toBe(true); // no bounce through /welcome
    expect(s.profile).toBeNull(); // A's profile is gone; B's is fetched next
    expect(s.phoneNumber).toBeNull();
    expect(s.confirmationResult).toBeNull();
    expect(s.error).toBeNull();
  });

  it('uid change detected even when login already wrote B into the store', async () => {
    await signIn('A');
    // loginWithEmail sets `user` before Firebase's listener fires.
    useAuthStore.setState({ user: fbUser('B') });
    mockCalls.length = 0;
    await st().syncAuthUser(fbUser('B'));
    expect(mockCalls).toContain('clearUserSession');
    expect(mockCalls).toContain('unregisterLocal');
  });

  it('relaunch with a valid session keeps the cache', async () => {
    await st().syncAuthUser(fbUser('A'));
    expect(mockCalls).not.toContain('clearUserSession');
    expect(st().isAuthenticated).toBe(true);
    // The same user re-emitted (token refresh) changes nothing either.
    mockCalls.length = 0;
    await st().syncAuthUser(fbUser('A'));
    expect(mockCalls).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Overlapping auth events (review round 1). Events run one at a time, and a
// stale event never writes auth state over a newer one.
// ─────────────────────────────────────────────────────────────────────────────
describe('syncAuthUser() with overlapping events', () => {
  /** Hold the push teardown until `release()` is called. */
  function holdTeardown() {
    let release: () => void = () => {};
    mockGate.wait = new Promise<void>((r) => {
      release = r;
    });
    return () => {
      mockGate.wait = null;
      release();
    };
  }

  /** Record every isAuthenticated value the store goes through. */
  function trackAuthFlips() {
    const seen: boolean[] = [];
    const unsub = useAuthStore.subscribe((s, prev) => {
      if (s.isAuthenticated !== prev.isAuthenticated)
        seen.push(s.isAuthenticated);
    });
    return { seen, unsub };
  }

  it("A's session ends, B signs in mid-teardown: B stays signed in", async () => {
    await signIn('A');
    const release = holdTeardown();

    // A's session ends on its own; the teardown hangs on the network.
    const aEnded = st().syncAuthUser(null);
    // B signs in meanwhile: loginWithEmail writes B into the store first,
    // then Firebase's listener fires with B.
    mockFirebase.currentUser = { uid: 'B' };
    useAuthStore.setState({ user: fbUser('B'), isAuthenticated: true });
    // (That write swaps the answer drafts A → B via the #187 subscription;
    // only the queue's side effects matter from here.)
    mockCalls.length = 0;
    const flips = trackAuthFlips();
    const bSignedIn = st().syncAuthUser(fbUser('B'));

    // B's event is queued behind A's teardown: nothing has run yet.
    await Promise.resolve();
    expect(mockCalls).toEqual([]);

    release();
    await Promise.all([aEnded, bSignedIn]);

    // A's teardown ran once, and B's event did not tear anything down.
    expect(mockCalls).toEqual(['unregisterLocal', 'clearUserSession']);
    // A's stale reset never signed B out (no bounce to /welcome).
    expect(flips.seen).toEqual([]);
    expect(st().user?.uid).toBe('B');
    expect(st().isAuthenticated).toBe(true);
    flips.unsub();
  });

  it('same, when B reaches the listener before the store', async () => {
    await signIn('A');
    const release = holdTeardown();
    const aEnded = st().syncAuthUser(null);
    mockFirebase.currentUser = { uid: 'B' };
    const bSignedIn = st().syncAuthUser(fbUser('B'));
    release();
    await Promise.all([aEnded, bSignedIn]);
    expect(mockCalls.filter((c) => c.startsWith('unregister'))).toEqual([
      'unregisterLocal',
    ]);
    expect(st().user?.uid).toBe('B');
    expect(st().isAuthenticated).toBe(true);
  });

  it('A switches to B, then signs out mid-teardown: ends signed out', async () => {
    await signIn('A');
    const release = holdTeardown();
    const switched = st().syncAuthUser(fbUser('B'));
    const signedOut = st().syncAuthUser(null);
    release();
    await Promise.all([switched, signedOut]);
    // The stale switch never signed B in after the sign-out.
    expect(st().user).toBeNull();
    expect(st().isAuthenticated).toBe(false);
  });
});
