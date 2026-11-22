// ─────────────────────────────────────────────────────────────────────────────
// usePlanChanged — run a callback when the signed-in client's plan changes
// (japa#473).
//
// WHY: a locked action ("See plans" after a 402) keeps its locked state in the
// screen's local state (`failure === 'upgrade'`, an error object, …). After the
// client subscribes on the plans screen and comes back, that local state must
// clear so the action is tappable again. It must NOT clear just because the
// client came back: only a real plan change, as the SERVER reports it, counts.
//
// HOW: the plan is read from `GET /subscriptions/me` (`['subscription','me']`),
// the query `useVerifySubscription` (#252) refreshes after a confirmed verify.
// We build a small "plan signature" (plan id + status + entitlements) and call
// `onChange` when the signature moves from one KNOWN value to a DIFFERENT one.
//
//   - first load (unknown → known): no call. The screen's state was set under
//     that same plan, so nothing has changed. Exception: if that first read
//     FAILED, the first good read later counts as a change (no baseline).
//   - unchanged after a refetch (the client closed checkout without paying):
//     no call, so the locked state stays and they can try again.
//   - changed (paid; or the webhook landed and a foreground refetch saw it):
//     one call. The screen clears its locked state; the next tap goes to the
//     server, which decides again (a cheaper plan still answers 402).
//
// Nothing here trusts a client flag: the signature only ever comes from the
// server's answer.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import {
  useMySubscription,
  type MySubscription,
} from '@/hooks/useSubscription';

/**
 * A stable string for "which plan, with which entitlements". `undefined` while
 * the subscription is not known yet (loading, or the call failed with no data).
 * Exported for tests.
 */
export function planSignature(
  data: MySubscription | null | undefined,
): string | undefined {
  // `undefined` = not answered yet. `null` is a real answer (no paid plan).
  if (data === undefined) return undefined;
  const sub = data?.subscription ?? null;
  return JSON.stringify([
    sub?.planId ?? null,
    // A cancelled → active move on the same plan id also unlocks things.
    sub?.status ?? null,
    data?.entitlements ?? null,
  ]);
}

/**
 * Call `onChange` once each time the plan signature changes from one known
 * value to another. The latest `onChange` is always used (kept in a ref), so
 * callers can pass an inline arrow without re-subscribing.
 */
export function usePlanChanged(onChange: () => void): void {
  const { data, isError } = useMySubscription();
  const signature = planSignature(data);

  // Latest callback, so the effect below only depends on the signature.
  const cb = useRef(onChange);
  cb.current = onChange;

  // The last KNOWN signature (never set back to undefined: a refetch that
  // fails keeps the old data, and a failed read is not a plan change).
  const last = useRef<string | undefined>(undefined);

  // japa#474 fix round 1 (review): the FIRST read failed, so the screen's
  // locked state was set while the plan was unknown. Then the first good
  // read (e.g. the one verify triggers after paying) can't be treated as
  // "nothing changed": we have no baseline to compare it with. It counts as
  // a change from "locked" and clears the lock once. That is safe: clearing
  // only makes the action tappable, and the tap still goes to the server
  // (a plan that still lacks the action answers 402 again).
  const failedBeforeKnown = useRef(false);
  if (isError && signature === undefined && last.current === undefined) {
    failedBeforeKnown.current = true;
  }

  useEffect(() => {
    if (signature === undefined) return;
    const previous = last.current;
    last.current = signature;
    if (previous === undefined) {
      // First known value. Normally: remember it, nothing changed. After a
      // failed first read: no baseline, so it counts as a change (above).
      if (!failedBeforeKnown.current) return;
      failedBeforeKnown.current = false;
      cb.current();
      return;
    }
    if (previous === signature) return;
    cb.current();
  }, [signature]);
}
