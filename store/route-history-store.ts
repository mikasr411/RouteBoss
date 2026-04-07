import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { SavedRoute } from "@/types/saved-route";
import type { ManualRouteStop } from "@/types/manual-stop";
import type { RouteStartPoint, RouteStopKey } from "@/types/route-plan";

const STORAGE_KEY = "routeboss:routeHistory";
const MAX_SAVED_ROUTES = 80;

type RouteHistoryState = {
  savedRoutes: SavedRoute[];
  /** Returns the new entry id */
  saveRoute: (params: {
    name: string;
    routeDate: string;
    customerIds: string[];
    manualStops: ManualRouteStop[];
    routeStopOrder?: RouteStopKey[];
    routeStart?: RouteStartPoint | null;
  }) => string;
  removeSavedRoute: (id: string) => void;
};

function cloneStops(stops: ManualRouteStop[]): ManualRouteStop[] {
  return stops.map((s) => ({ ...s }));
}

export const useRouteHistoryStore = create<RouteHistoryState>()(
  persist(
    (set) => ({
      savedRoutes: [],
      saveRoute: ({
        name,
        routeDate,
        customerIds,
        manualStops,
        routeStopOrder,
        routeStart,
      }) => {
        const id = uuidv4();
        const savedAt = new Date().toISOString();
        const entry: SavedRoute = {
          id,
          savedAt,
          name: name.trim() || "Untitled route",
          routeDate,
          customerIds: [...customerIds],
          manualStops: cloneStops(manualStops),
          ...(routeStopOrder !== undefined
            ? { routeStopOrder: routeStopOrder.map((k) => ({ ...k })) }
            : {}),
          ...(routeStart !== undefined ? { routeStart } : {}),
        };
        set((state) => ({
          savedRoutes: [entry, ...state.savedRoutes].slice(0, MAX_SAVED_ROUTES),
        }));
        return id;
      },
      removeSavedRoute: (id) =>
        set((state) => ({
          savedRoutes: state.savedRoutes.filter((r) => r.id !== id),
        })),
    }),
    { name: STORAGE_KEY }
  )
);
