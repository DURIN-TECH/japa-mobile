// ─────────────────────────────────────────────────────────────────────────────
// Self-service-only route table (japa#334).
//
// The ONE place that says which screens a self-service-only build (flag
// `EXPO_PUBLIC_SELF_SERVICE_ONLY=true`, see `selfServiceOnly.ts`) must never
// show. Two consumers:
//   - the root route guard in `src/app/_layout.tsx`, which sends a hidden
//     route (deep links, stray pushes) to Home: back to the existing tab
//     shell's Home tab when there is one (`selfServiceRedirectState` below),
//     else `replace` to `/(tabs)/home` (cold start);
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

// ─────────────────────────────────────────────────────────────────────────────
// The redirect itself (japa#334, QA round 1)
//
// A hidden deep link opened while the app runs pushes the hidden screen on
// top of the existing tab shell: root stack `[(tabs), messages]`. A plain
// `router.replace('/(tabs)/home')` swaps `messages` for a SECOND tab shell
// (`[(tabs), (tabs)]`), so Back from Home stepped into the old shell and
// every further hidden link added another one.
//
// Instead, the guard resets the navigation state to what it was below the
// hidden screen: the stack is cut back to the nearest tab shell under it,
// and that shell's focused tab is switched to Home. Route keys are kept, so
// React Navigation keeps the existing screens mounted. Result: one `(tabs)`
// entry, on Home, nothing above it, Back has nowhere in-app to go.
//
// Expo Router 58 (SDK 58, japa#399): the guard applies the result as a
// RESET action (`resetRoot` was removed). RESET needs a COMPLETE state
// (`key`, `routeNames`, `routeKeySeq`, `stale: false` at every level); the
// helper keeps them because it spreads the existing state at each level.
//
// When there is no tab shell below (a cold start straight into a hidden
// link), this returns null and the guard falls back to `replace`, which
// already ends on Home with one shell.
//
// Why not `Stack.Protected` around the hidden screens: it was considered,
// but a link to a protected route was not verified to land on Home on this
// expo-router version (56.2.x), and the acceptance criteria require Home.
// This reset keeps the one route table above as the only source of truth.
// ─────────────────────────────────────────────────────────────────────────────

/** The parts of a React Navigation state this helper reads and rebuilds. */
export interface NavStateLike {
  index?: number;
  routes: NavRouteLike[];
  [key: string]: unknown;
}
export interface NavRouteLike {
  name: string;
  key?: string;
  state?: NavStateLike;
  [key: string]: unknown;
}

const TABS_ROUTE = '(tabs)';
const HOME_TAB = 'home';

/** Focused index of a state (React Navigation defaults to the last route). */
const focusedIndex = (s: NavStateLike) =>
  typeof s.index === 'number' ? s.index : s.routes.length - 1;

/**
 * The root state to reset to so a hidden route ends on the EXISTING tab
 * shell's Home tab, or null when there is no tab shell to go back to (or the
 * state is not the expected shape). Pure; never mutates `root`.
 */
export function selfServiceRedirectState(
  root: NavStateLike | null | undefined,
): NavStateLike | null {
  if (!root || !Array.isArray(root.routes) || root.routes.length === 0)
    return null;

  // The app's Stack (src/app/_layout.tsx) is the first level, following the
  // focused routes down from the container root (expo-router wraps it in a
  // `__root` route), whose routes include the tab shell.
  const level = (s: NavStateLike): NavStateLike | null => {
    if (s.routes.some((r) => r.name === TABS_ROUTE)) {
      // The tab shell at or below the focused route (the hidden screen sits
      // on top of it; for `/agents` the shell itself is focused).
      const top = focusedIndex(s);
      let shell = -1;
      for (let i = Math.min(top, s.routes.length - 1); i >= 0; i--) {
        if (s.routes[i].name === TABS_ROUTE) {
          shell = i;
          break;
        }
      }
      if (shell < 0) return null;
      const tabs = s.routes[shell];
      const tabState = tabs.state;
      const home = tabState?.routes.findIndex((r) => r.name === HOME_TAB) ?? -1;
      // Tab state not built yet or no Home tab: let the guard replace instead.
      if (!tabState || home < 0) return null;
      const routes = s.routes.slice(0, shell + 1);
      // Tab routers keep a back history next to `index`; point it at Home
      // too, so Back from Home cannot step to the tab the user came from.
      const homeKey = tabState.routes[home].key;
      const history = Array.isArray(tabState.history)
        ? homeKey
          ? [{ type: 'route', key: homeKey }]
          : undefined
        : tabState.history;
      routes[shell] = {
        ...tabs,
        state: {
          ...tabState,
          index: home,
          ...(history !== undefined ? { history } : {}),
        },
      };
      return { ...s, routes, index: shell };
    }
    // Not this level: descend into the focused route's child state.
    const i = focusedIndex(s);
    const child = s.routes[i]?.state;
    if (!child || !Array.isArray(child.routes)) return null;
    const next = level(child);
    if (!next) return null;
    const routes = [...s.routes];
    routes[i] = { ...routes[i], state: next };
    return { ...s, routes };
  };

  return level(root);
}
