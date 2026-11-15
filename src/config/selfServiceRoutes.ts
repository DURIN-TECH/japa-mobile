// ─────────────────────────────────────────────────────────────────────────────
// Self-service-only route table (japa#334).
//
// The ONE place that says which screens a self-service-only build (flag
// `EXPO_PUBLIC_SELF_SERVICE_ONLY=true`, see `selfServiceOnly.ts`) must never
// show. Two consumers:
//   - the root route guard in `src/app/_layout.tsx`, which redirects a hidden
//     route to `/(tabs)/home` with `replace` (deep links, stray pushes);
//   - the notification router (`services/notification-router.ts`), as a
//     safety net so a notice can never resolve to a hidden screen.
//
// Pure on purpose: no React, no expo-router, no env read. The flag is a
// parameter, so tests cover both states without touching the build config.
//
// Matching works on the FIRST real route segment. Expo Router groups like
// `(tabs)` are dropped first, so `['(tabs)', 'agents']` (from `useSegments`)
// and the pathname `/agents` (from a deep link or a route string) both match
// `agents`. Every child route of a hidden folder is hidden with it
// (`messages/[id]`, `consultation/[id]`, ...).
//
// Hidden here = an agent / agency / booking / messaging / agent-payment
// screen, or a screen only those flows lead to. Everything else (auth,
// onboarding, the other tabs, destination, visa, self-service, application,
// documents, subscription, payment-return, notifications, settings, ...) is
// kept: see the keep/hide table on japa#334.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * First route segments hidden in a self-service-only build, with why.
 * Exact segment names: `pay` and `payments` are hidden, `payment-return`
 * (the subscription's Paystack return) is NOT.
 */
export const SELF_SERVICE_HIDDEN_SEGMENTS: ReadonlySet<string> = new Set([
  'agents', // (tabs)/agents: the agent + agency directory tab
  'agent', // agent/[id]: agent profile
  'agency', // agency/[id]: agency profile
  'book', // book/[agentId]: consultation booking
  'consultations', // consultations: booking list
  'consultation', // consultation/[id]: booking detail
  'messages', // messages/index, messages/[id]: chat with agents
  'pay', // pay: consultation / agent payment-request checkout
  'payments', // payments: consultation, service and government fees
  'confirmation', // confirmation: booking / agent-fee receipt (from `pay`)
  'ai-message-access', // AI consent inside agent conversations
  'verify-identity', // Dojah KYC: no self-service screen requires it
  'shared-document', // shared-document/[id]: agency-shared document reader
]);

/** Expo Router group segment, e.g. `(tabs)`; groups never appear in URLs. */
const isGroup = (segment: string) => /^\(.*\)$/.test(segment);

/**
 * The first real route segment of a pathname (`/messages/abc?x=1`) or of
 * `useSegments()` output (`['(tabs)', 'agents']`). Undefined for `/`.
 */
function firstSegment(route: string | readonly string[]): string | undefined {
  const parts =
    typeof route === 'string'
      ? // Drop the query / hash, then split the path into segments.
        route.split(/[?#]/)[0].split('/')
      : route;
  return parts.find((part) => part && !isGroup(part));
}

/**
 * Whether `route` is hidden in a self-service-only build.
 *
 * Always false when `selfServiceOnly` is false: with the flag off nothing is
 * ever redirected or filtered, so the app behaves exactly as before.
 */
export function isHiddenInSelfServiceOnly(
  route: string | readonly string[] | null | undefined,
  selfServiceOnly: boolean,
): boolean {
  if (!selfServiceOnly || route == null) return false;
  const first = firstSegment(route);
  return first !== undefined && SELF_SERVICE_HIDDEN_SEGMENTS.has(first);
}

/** Where the guard sends a hidden route (Home is always kept). */
export const SELF_SERVICE_REDIRECT = '/(tabs)/home' as const;
