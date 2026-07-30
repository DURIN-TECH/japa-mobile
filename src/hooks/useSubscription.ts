import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Entitlements,
  FeatureKey,
  PlanInterval,
  Subscription,
  SubscriberType,
} from '@durin-tech/authz';
import { apiService } from '@/services/api.service';

/** GET /subscriptions/me */
export interface MySubscription {
  subscriberType?: SubscriberType;
  subscription: Subscription | null;
  entitlements: Entitlements | null;
  unlimited?: boolean;
}

/** A plan as returned by GET /plans (subset of the backend StoredPlan). */
export interface PlanDTO {
  id: string;
  name: string;
  audience: SubscriberType;
  priceKobo: number;
  interval: PlanInterval;
  features: FeatureKey[];
  seatPriceKobo?: number;
  isActive?: boolean;
}

/** The current user's subscription + resolved entitlements. */
export function useMySubscription() {
  return useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: async () => {
      const res = await apiService.get<MySubscription>('/subscriptions/me');
      return res.data ?? null;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Plans available to a given audience (mobile clients → "client"). */
export function usePlans(audience?: SubscriberType) {
  return useQuery({
    queryKey: ['plans', audience],
    enabled: !!audience,
    queryFn: async () => {
      const res = await apiService.get<PlanDTO[]>(
        `/plans?audience=${audience}`,
      );
      return (res.data ?? []).filter((p) => p.isActive !== false);
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Start a Paystack checkout to switch plans. Returns the hosted checkout URL — the
 * caller opens it in the browser (app-to-web purchase, avoids store IAP). Access is
 * granted only after the verified webhook.
 */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiService.post<{ url: string; reference: string }>(
        '/subscriptions/checkout',
        { planId },
      );
      return res.data?.url ?? null;
    },
  });
}
