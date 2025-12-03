import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types/customer";

type CustomerStore = {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  clearCustomers: () => void;
};

const STORAGE_KEY = "routeboss:customers";

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set) => ({
      customers: [],
      setCustomers: (customers) => set({ customers }),
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),
      clearCustomers: () => set({ customers: [] }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

