import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
// japa#474: re-read the plan when the app returns to the foreground.
import { usePlanForegroundRefresh } from '@/hooks/usePlanForegroundRefresh';
// japa#474 fix round 1: the plan fetchers, registered as client defaults.
import { mySubscriptionQuery } from '@/hooks/useSubscription';
import { authorizationQuery } from '@/hooks/authorizationQuery';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// japa#474 fix round 1: register the two plan fetchers on the client, so a
// pull-to-refresh can re-read the plan (`refetchPlanQueries`) even on a cold
// start, before any screen has cached it. The hooks pass the same fetchers.
queryClient.setQueryDefaults(mySubscriptionQuery.queryKey, {
  queryFn: mySubscriptionQuery.queryFn,
});
queryClient.setQueryDefaults(authorizationQuery.queryKey, {
  queryFn: authorizationQuery.queryFn,
});

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Mounts the app-wide foreground listener inside the provider (it needs the
 * query client). Renders nothing.
 */
function PlanForegroundRefresh() {
  usePlanForegroundRefresh();
  return null;
}

export function QueryProvider({ children }: Readonly<QueryProviderProps>) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlanForegroundRefresh />
      {children}
    </QueryClientProvider>
  );
}

export { queryClient };
