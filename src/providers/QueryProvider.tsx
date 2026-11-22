import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
// japa#474: re-read the plan when the app returns to the foreground.
import { usePlanForegroundRefresh } from '@/hooks/usePlanForegroundRefresh';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
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
