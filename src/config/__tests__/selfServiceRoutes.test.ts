// ─────────────────────────────────────────────────────────────────────────────
// Self-service-only route guard (japa#334): every row of the keep/hide table,
// both as `useSegments()` output (what the root layout passes) and as a
// pathname (deep links, notification routes), with the flag on and off.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import {
  isHiddenInSelfServiceOnly as hidden,
  SELF_SERVICE_HIDDEN_SEGMENTS,
  SELF_SERVICE_REDIRECT,
} from '../selfServiceRoutes';

// Hidden routes: [segments from useSegments(), the deep-link pathname].
const HIDDEN: [string[], string][] = [
  [['(tabs)', 'agents'], '/agents'],
  [['agent', '[id]'], '/agent/x'],
  [['agency', '[id]'], '/agency/x'],
  [['book', '[agentId]'], '/book/x'],
  [['consultations'], '/consultations'],
  [['consultation', '[id]'], '/consultation/x'],
  [['messages'], '/messages'],
  [['messages', '[id]'], '/messages/x'],
  [['pay'], '/pay'],
  [['payments'], '/payments'],
  [['confirmation'], '/confirmation'],
  [['ai-message-access'], '/ai-message-access'],
  [['verify-identity'], '/verify-identity'],
  [['shared-document', '[id]'], '/shared-document/x'],
];

// Kept routes: never redirected, flag on or off.
const KEPT: [string[], string][] = [
  [[], '/'],
  [['+not-found'], '/does-not-exist'],
  [['(auth)', 'welcome'], '/welcome'],
  [['(auth)', 'login'], '/login'],
  [['(auth)', 'register'], '/register'],
  [['(auth)', 'otp'], '/otp'],
  [['(auth)', 'forgot-password'], '/forgot-password'],
  [['(onboard)', 'passport'], '/passport'],
  [['(onboard)', 'country'], '/country'],
  [['(onboard)', 'personal-info'], '/personal-info'],
  [['(onboard)', 'complete'], '/complete'],
  [['(tabs)', 'home'], '/home'],
  [['(tabs)', 'explore'], '/explore'],
  [['(tabs)', 'tracker'], '/tracker'],
  [['(tabs)', 'profile'], '/profile'],
  [['destination', '[id]'], '/destination/x'],
  [['visa', '[id]'], '/visa/x'],
  [['apply-through', '[visaId]'], '/apply-through/x'],
  [['eligibility'], '/eligibility'],
  [['eligibility', 'result'], '/eligibility/result'],
  [['self-service', '[id]'], '/self-service/x'],
  [['self-service', '[id]', 'intake'], '/self-service/x/intake'],
  [['self-service', '[id]', 'review'], '/self-service/x/review'],
  [['self-service', '[id]', 'statement'], '/self-service/x/statement'],
  [
    ['self-service', 'refusal-letter'],
    '/self-service/refusal-letter?applicationId=a1',
  ],
  [['application', '[id]'], '/application/x'],
  [['ai-chat', '[id]'], '/ai-chat/x'],
  [['documents'], '/documents'],
  [['holdings'], '/holdings'],
  [['holdings', 'pick-country'], '/holdings/pick-country'],
  [['holdings', 'add-document'], '/holdings/add-document'],
  [['saved'], '/saved'],
  [['subscription'], '/subscription'],
  [['payment-return'], '/payment-return'],
  [['notifications'], '/notifications'],
  [['settings'], '/settings'],
  [['verify-email'], '/verify-email'],
  [['change-password'], '/change-password'],
  [['change-email'], '/change-email'],
  [['delete-account'], '/delete-account'],
];

describe('isHiddenInSelfServiceOnly, flag on', () => {
  it.each(HIDDEN)('hides %j (%s)', (segments, pathname) => {
    expect(hidden(segments, true)).toBe(true);
    expect(hidden(pathname, true)).toBe(true);
  });

  it.each(KEPT)('keeps %j (%s)', (segments, pathname) => {
    expect(hidden(segments, true)).toBe(false);
    expect(hidden(pathname, true)).toBe(false);
  });

  it('keeps unknown routes (the 404 screen handles them)', () => {
    expect(hidden(['something-new'], true)).toBe(false);
    expect(hidden('/something-new/abc', true)).toBe(false);
  });

  it('matches whole segments only, never prefixes', () => {
    // `payment-return` (subscription return) is kept although `pay` and
    // `payments` are hidden; `agents-x` is not `agents`.
    expect(hidden('/payment-return?ref=1', true)).toBe(false);
    expect(hidden('/agents-x', true)).toBe(false);
    expect(hidden('/pay?consultationId=1', true)).toBe(true);
  });

  it('copes with missing input', () => {
    expect(hidden(undefined, true)).toBe(false);
    expect(hidden(null, true)).toBe(false);
    expect(hidden('', true)).toBe(false);
  });
});

describe('isHiddenInSelfServiceOnly, flag off', () => {
  it.each([...HIDDEN, ...KEPT])('never hides %j (%s)', (segments, pathname) => {
    expect(hidden(segments, false)).toBe(false);
    expect(hidden(pathname, false)).toBe(false);
  });
});

describe('the route table', () => {
  it('lists exactly the hidden rows of the japa#334 table', () => {
    expect([...SELF_SERVICE_HIDDEN_SEGMENTS].sort()).toEqual(
      [
        'agents',
        'agent',
        'agency',
        'book',
        'consultations',
        'consultation',
        'messages',
        'pay',
        'payments',
        'confirmation',
        'ai-message-access',
        'verify-identity',
        'shared-document',
      ].sort(),
    );
  });

  it('redirects to Home, which is itself kept', () => {
    expect(SELF_SERVICE_REDIRECT).toBe('/(tabs)/home');
    expect(hidden(SELF_SERVICE_REDIRECT, true)).toBe(false);
  });

  it('covers every route folder or file in src/app', () => {
    // A new top-level route must be classified: either hidden here or in
    // the KEPT list above. Keeps the table honest as screens are added.
    const appDir = path.join(__dirname, '../../app');
    const known = new Set([
      ...SELF_SERVICE_HIDDEN_SEGMENTS,
      ...KEPT.flatMap(([segments]) => segments.slice(0, 1)),
      ...KEPT.flatMap(([segments]) => segments.slice(1, 2)),
      '(tabs)',
      '(auth)',
      '(onboard)',
      'index',
      '_layout',
      '__tests__',
    ]);
    const routes = fs
      .readdirSync(appDir)
      .map((name) => name.replace(/\.tsx?$/, ''));
    for (const route of routes) expect(known).toContain(route);
  });
});
