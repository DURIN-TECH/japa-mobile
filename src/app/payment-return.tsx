// ─────────────────────────────────────────────────────────────────────────────
// /payment-return — landing route for `durintech://payment-return` (japa#252).
//
// After Paystack, the backend's public return page sends the browser to this
// deep link. On iOS the in-app auth browser (ASWebAuthenticationSession)
// captures it, so this route is never reached. On Android the Custom Tab hands
// the link to the app as a normal intent, so Expo Router may ALSO push this
// route; without this file that would land on +not-found and strand the user.
//
// The route does nothing with the URL — it grants nothing and reads no
// reference: the screen that opened checkout (subscription / pay) is still on
// the stack and verifies its own reference with the backend. We finish the
// auth session (a no-op on native; completes it on web) and remove ourselves.
//
// Review fix (#252): we ONLY step back while this route is the focused (top)
// screen. If the pay screen's verify already pushed /confirmation on top of
// us, a blind `router.back()` would pop the confirmation instead. So the step
// back runs in a focus effect: it fires now if we are on top, and otherwise
// the next time we come back into focus (e.g. the user backs out of
// /confirmation), never while another screen is above us. With nothing to go
// back to (cold or forged link) we go home.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { StateLoading } from '@/components/explorer/states';
import { paymentReturnLeaveAction } from '@/hooks/paystackCheckout';

export default function PaymentReturn() {
  const router = useRouter();
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      // Completes a pending auth session on web; returns "failed" on native.
      WebBrowser.maybeCompleteAuthSession();
      // Re-check focus at call time: only the top screen may step back.
      const action = paymentReturnLeaveAction(
        navigation.isFocused(),
        router.canGoBack(),
      );
      if (action === 'back') router.back();
      else if (action === 'home') router.replace('/(tabs)/home');
    }, [navigation, router]),
  );

  // Shown for a frame at most: the coral spinner, the system loading state.
  return <StateLoading />;
}
