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

const routeKey = (k: RouteStopKey) => `${k.kind}:${k.id}`;

function stopSortLabel(
  k: RouteStopKey,
  customers: Customer[],
  manualStops: ManualRouteStop[]
): string {
  if (k.kind === "customer") {
    return (customers.find((c) => c.id === k.id)?.displayName ?? "").trim();
  }
  return (manualStops.find((s) => s.id === k.id)?.label ?? "").trim();
}

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

function sameRouteKeySet(a: RouteStopKey[], b: RouteStopKey[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(routeKey));
  if (sa.size !== b.length) return false;
  for (const k of b) {
    if (!sa.has(routeKey(k))) return false;
  }
  return true;
}

/** When stops are added/removed → A–Z by display name / extra-stop label. Same set → keep order (↑↓). */
function buildSyncedRouteOrder(
  order: RouteStopKey[],
  customers: Customer[],
  manualStops: ManualRouteStop[]
): RouteStopKey[] {
  const expected = buildExpectedRouteKeys(customers, manualStops);
  const expectedSet = new Set(expected.map(routeKey));

  const filtered = order.filter((k) => expectedSet.has(routeKey(k)));

  if (sameRouteKeySet(filtered, expected)) {
    return filtered;
  }

  return [...expected].sort((a, b) => {
    const cmp = stopSortLabel(a, customers, manualStops).localeCompare(
      stopSortLabel(b, customers, manualStops),
      undefined,
      { sensitivity: "base" }
    );
    if (cmp !== 0) return cmp;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.id.localeCompare(b.id);
  });
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

