import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 2 minutes before refetching
        staleTime: 2 * 60_000,
        // Keep data in cache for 10 minutes
        gcTime: 10 * 60_000,
        // Don't refetch just because the window got focus — avoids unnecessary network calls
        refetchOnWindowFocus: false,
        retry: 1,
        // Retry after 3s on failure, not immediately
        retryDelay: 3000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // "viewport" preloads any route whose <Link> is visible on screen —
    // critical for mobile users (Meta Ads traffic) who never hover.
    // Previously "intent" (hover-only) meant zero preloading on mobile.
    defaultPreload: "viewport",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
