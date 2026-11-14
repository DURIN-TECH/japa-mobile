// ─────────────────────────────────────────────────────────────────────────────
// /payment-return — landing route for `durintech://payment-return` (japa#252).
//
// After Paystack, the backend's public return page redirects to this deep link.
// On iOS the in-app auth browser (ASWebAuthenticationSession) captures it, so
// this route is never reached. On Android the Custom Tab hands the link to the
// app as a normal intent, so Expo Router may ALSO navigate here; without this
// file that would land on +not-found and strand the user.
//
// The route does nothing with the URL — it grants nothing and reads no
// reference: the screen that opened checkout (subscription / pay) is still on
// the stack and verifies its own reference with the backend. So we only finish
// the auth session (a no-op on native; completes it on web) and step straight
// back to that screen, or home when there is nothing to go back to (e.g. the
// link was opened cold or forged).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { StateLoading } from '@/components/explorer/states';

export default function PaymentReturn() {
  const router = useRouter();

  useEffect(() => {
    // Completes a pending auth session on web; returns "failed" on native.
    WebBrowser.maybeCompleteAuthSession();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [router]);

  // Shown for a frame at most: the coral spinner, the system loading state.
  return <StateLoading />;
}
