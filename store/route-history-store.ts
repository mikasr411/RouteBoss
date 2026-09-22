import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { SavedRoute } from "@/types/saved-route";
import type { ManualRouteStop } from "@/types/manual-stop";
import type { RouteStartPoint, RouteStopKey } from "@/types/route-plan";
import { remapCustomerIdList } from "@/lib/customer-duplicates";

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
  /** Reschedule a saved route to a different day (yyyy-MM-dd) */
  updateSavedRouteDate: (id: string, routeDate: string) => void;
  /** Save a new visit order for a saved route's stops */
  updateSavedRouteStopOrder: (
    id: string,
    routeStopOrder: RouteStopKey[]
  ) => void;
  /** Replace a saved route's snapshot (e.g. re-save after editing on the Map) */
  updateSavedRoute: (
    id: string,
    patch: {
      name?: string;
      routeDate?: string;
      customerIds: string[];
      manualStops: ManualRouteStop[];
      routeStopOrder?: RouteStopKey[];
      routeStart?: RouteStartPoint | null;
    }
  ) => void;
  /** Point absorbed customer ids at the kept id after a duplicate merge. */
  remapCustomerIds: (absorbIds: string[], keepId: string) => void;
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
      updateSavedRouteDate: (id, routeDate) =>
        set((state) => ({
          savedRoutes: state.savedRoutes.map((r) =>
            r.id === id ? { ...r, routeDate } : r
          ),
        })),
      updateSavedRouteStopOrder: (id, routeStopOrder) =>
        set((state) => ({
          savedRoutes: state.savedRoutes.map((r) =>
            r.id === id
              ? { ...r, routeStopOrder: routeStopOrder.map((k) => ({ ...k })) }
              : r
          ),
        })),
      updateSavedRoute: (id, patch) =>
        set((state) => ({
          savedRoutes: state.savedRoutes.map((r) => {
            if (r.id !== id) return r;
            return {
              ...r,
              savedAt: new Date().toISOString(),
              ...(patch.name !== undefined
                ? { name: patch.name.trim() || r.name }
                : {}),
              ...(patch.routeDate !== undefined
                ? { routeDate: patch.routeDate }
                : {}),
              customerIds: [...patch.customerIds],
              manualStops: cloneStops(patch.manualStops),
              ...(patch.routeStopOrder !== undefined
                ? {
                    routeStopOrder: patch.routeStopOrder.map((k) => ({ ...k })),
                  }
                : {}),
              ...(patch.routeStart !== undefined
                ? { routeStart: patch.routeStart }
                : {}),
            };
          }),
        })),
      remapCustomerIds: (absorbIds, keepId) =>
        set((state) => {
          if (absorbIds.length === 0) return state;
          const absorb = new Set(absorbIds);
          return {
            savedRoutes: state.savedRoutes.map((r) => {
              const seen = new Set<string>();
              const routeStopOrder = r.routeStopOrder
                ? r.routeStopOrder.reduce<RouteStopKey[]>((acc, k) => {
                    const next: RouteStopKey =
                      k.kind === "customer" && absorb.has(k.id)
                        ? { kind: "customer", id: keepId }
                        : k;
                    const sig = `${next.kind}:${next.id}`;
                    if (seen.has(sig)) return acc;
                    seen.add(sig);
                    acc.push(next);
                    return acc;
                  }, [])
                : r.routeStopOrder;
              return {
                ...r,
                customerIds: remapCustomerIdList(
                  r.customerIds,
                  absorbIds,
                  keepId
                ),
                routeStopOrder,
              };
            }),
          };
        }),
    }),
    { name: STORAGE_KEY }
  )
);
