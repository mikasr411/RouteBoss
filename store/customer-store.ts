import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types/customer";
import { ManualRouteStop } from "@/types/manual-stop";

type CustomerStore = {
  customers: Customer[];
  /** Ad-hoc stops added from the map (address lookup), included in route + export */
  manualStops: ManualRouteStop[];
  setCustomers: (customers: Customer[]) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  clearCustomers: () => void;
  addManualStop: (stop: ManualRouteStop) => void;
  removeManualStop: (id: string) => void;
  clearManualStops: () => void;
};

const STORAGE_KEY = "routeboss:customers";

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set) => ({
      customers: [],
      manualStops: [],
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
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

