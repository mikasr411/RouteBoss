import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types/customer";
import { ManualRouteStop } from "@/types/manual-stop";
import type { RouteStartPoint, RouteStopKey } from "@/types/route-plan";

function customerHasCoords(c: Customer): boolean {
  return (
    c.latitude != null &&
    c.longitude != null &&
    !Number.isNaN(Number(c.latitude)) &&
    !Number.isNaN(Number(c.longitude))
  );
}

function buildSyncedRouteOrder(
  order: RouteStopKey[],
  customers: Customer[],
  manualStops: ManualRouteStop[]
): RouteStopKey[] {
  const selectedIds = new Set(
    customers
      .filter((c) => c.isSelectedForRoute && customerHasCoords(c))
      .map((c) => c.id)
  );
  const manualIds = new Set(manualStops.map((s) => s.id));
  const next = order.filter((k) =>
    k.kind === "customer" ? selectedIds.has(k.id) : manualIds.has(k.id)
  );
  const key = (k: RouteStopKey) => `${k.kind}:${k.id}`;
  const seen = new Set(next.map(key));
  for (const c of customers) {
    if (
      c.isSelectedForRoute &&
      customerHasCoords(c) &&
      !seen.has(`customer:${c.id}`)
    ) {
      next.push({ kind: "customer", id: c.id });
      seen.add(`customer:${c.id}`);
    }
  }
  for (const s of manualStops) {
    if (!seen.has(`manual:${s.id}`)) {
      next.push({ kind: "manual", id: s.id });
      seen.add(`manual:${s.id}`);
    }
  }
  return next;
}

type CustomerStore = {
  customers: Customer[];
  /** Ad-hoc stops added from the map (address lookup), included in route + export */
  manualStops: ManualRouteStop[];
  /** Driving visit order (Map + directions). Synced when selections change. */
  routeStopOrder: RouteStopKey[];
  /** Optional starting location (shop / home) before first stop */
  routeStart: RouteStartPoint | null;
  setCustomers: (customers: Customer[]) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  clearCustomers: () => void;
  addManualStop: (stop: ManualRouteStop) => void;
  removeManualStop: (id: string) => void;
  clearManualStops: () => void;
  /** Replace all manual stops (e.g. when loading a saved route) */
  setManualStops: (stops: ManualRouteStop[]) => void;
  setRouteStopOrder: (order: RouteStopKey[]) => void;
  syncRouteStopOrder: () => void;
  moveRouteStopInOrder: (index: number, delta: -1 | 1) => void;
  setRouteStart: (start: RouteStartPoint | null) => void;
  clearRouteStart: () => void;
};

const STORAGE_KEY = "routeboss:customers";

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set) => ({
      customers: [],
      manualStops: [],
      routeStopOrder: [],
      routeStart: null,
      setCustomers: (customers) => set({ customers }),
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),
      clearCustomers: () => set({ customers: [] }),
      addManualStop: (stop) =>
        set((state) => ({
          manualStops: [...state.manualStops, stop],
        })),
      removeManualStop: (id) =>
        set((state) => ({
          manualStops: state.manualStops.filter((s) => s.id !== id),
        })),
      clearManualStops: () => set({ manualStops: [] }),
      setManualStops: (manualStops) => set({ manualStops }),
      setRouteStopOrder: (routeStopOrder) => set({ routeStopOrder }),
      syncRouteStopOrder: () =>
        set((state) => {
          const next = buildSyncedRouteOrder(
            state.routeStopOrder,
            state.customers,
            state.manualStops
          );
          if (
            next.length === state.routeStopOrder.length &&
            next.every(
              (k, i) =>
                k.kind === state.routeStopOrder[i]?.kind &&
                k.id === state.routeStopOrder[i]?.id
            )
          ) {
            return state;
          }
          return { routeStopOrder: next };
        }),
      moveRouteStopInOrder: (index, delta) =>
        set((state) => {
          const arr = [...state.routeStopOrder];
          const j = index + delta;
          if (j < 0 || j >= arr.length) return state;
          [arr[index], arr[j]] = [arr[j], arr[index]];
          return { routeStopOrder: arr };
        }),
      setRouteStart: (routeStart) => set({ routeStart }),
      clearRouteStart: () => set({ routeStart: null }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

