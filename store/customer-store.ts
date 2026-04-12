import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types/customer";
import { ManualRouteStop } from "@/types/manual-stop";
import type { RouteStartPoint, RouteStopKey } from "@/types/route-plan";
import { applyCustomerImportMerge } from "@/lib/customer-import-merge";

function customerHasCoords(c: Customer): boolean {
  return (
    c.latitude != null &&
    c.longitude != null &&
    !Number.isNaN(Number(c.latitude)) &&
    !Number.isNaN(Number(c.longitude))
  );
}

const routeKey = (k: RouteStopKey) => `${k.kind}:${k.id}`;

function buildExpectedRouteKeys(
  customers: Customer[],
  manualStops: ManualRouteStop[]
): RouteStopKey[] {
  const keys: RouteStopKey[] = [];
  for (const c of customers) {
    if (c.isSelectedForRoute && customerHasCoords(c)) {
      keys.push({ kind: "customer", id: c.id });
    }
  }
  for (const s of manualStops) {
    keys.push({ kind: "manual", id: s.id });
  }
  return keys;
}

/**
 * Stops removed from the route are dropped; order of remaining stops is unchanged.
 * Newly added stops are appended at the end (no alphabetical re-sort).
 */
function buildSyncedRouteOrder(
  order: RouteStopKey[],
  customers: Customer[],
  manualStops: ManualRouteStop[]
): RouteStopKey[] {
  const expected = buildExpectedRouteKeys(customers, manualStops);
  const expectedSet = new Set(expected.map(routeKey));

  const filtered = order.filter((k) => expectedSet.has(routeKey(k)));
  const filteredSet = new Set(filtered.map(routeKey));

  const additions: RouteStopKey[] = [];
  for (const k of expected) {
    if (!filteredSet.has(routeKey(k))) {
      additions.push(k);
    }
  }

  return [...filtered, ...additions];
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
  /** Match by Housecall Pro `id`: update from CSV, keep coords / route / notes / frequency; keep customers not in file */
  mergeCustomersFromImport: (imported: Customer[]) => void;
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
      mergeCustomersFromImport: (imported) =>
        set((state) => ({
          customers: applyCustomerImportMerge(state.customers, imported),
        })),
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

