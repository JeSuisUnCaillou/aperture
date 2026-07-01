import type { RouteDestinationView } from '@/types';

// routes-module. In-process pub/sub bridging the map context-menu "Add to routes"
// action to a mounted RoutePlannerModule: the menu persists the destination via a
// Server Action (so it works even when the route panel is hidden and unmounted),
// then publishes the saved row here so a mounted panel folds it optimistically
// instead of waiting for a navigation to reload `initialDestinations`.

type Listener = (dest: RouteDestinationView) => void;

const listeners = new Set<Listener>();

/** Broadcast a newly-saved route destination to any mounted RoutePlannerModule. */
export function publishRouteDestination(dest: RouteDestinationView): void {
  for (const cb of listeners) cb(dest);
}

/** Subscribe to route-destination additions. Returns an unsubscribe function. */
export function subscribeRouteDestinations(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
