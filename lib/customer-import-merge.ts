import type { Customer } from "@/types/customer";
import { calculateNextServiceDate } from "@/lib/utils";

/**
 * Merge a CSV-parsed row into an existing customer (same Housecall Pro `id`).
 * CSV wins for exported fields; local enrichments are preserved.
 */
export function mergeImportedCustomer(
  existing: Customer,
  incoming: Customer
): Customer {
  const frequency = existing.serviceFrequency;
  const nextFromLast = calculateNextServiceDate(
    incoming.lastServiceDate,
    frequency
  );

  return {
    ...incoming,
    serviceFrequency: frequency,
    nextServiceDate: nextFromLast ?? incoming.nextServiceDate,
    latitude:
      existing.latitude != null && !Number.isNaN(Number(existing.latitude))
        ? existing.latitude
        : incoming.latitude,
    longitude:
      existing.longitude != null && !Number.isNaN(Number(existing.longitude))
        ? existing.longitude
        : incoming.longitude,
    isSelectedForRoute: existing.isSelectedForRoute,
    notes: existing.notes,
  };
}

/**
 * Upsert imported rows by `id`. Customers not present in the import file are kept.
 */
export function applyCustomerImportMerge(
  existingCustomers: Customer[],
  imported: Customer[]
): Customer[] {
  const byId = new Map(existingCustomers.map((c) => [c.id, { ...c }]));
  for (const incoming of imported) {
    const prev = byId.get(incoming.id);
    if (prev) {
      byId.set(incoming.id, mergeImportedCustomer(prev, incoming));
    } else {
      byId.set(incoming.id, { ...incoming });
    }
  }
  return Array.from(byId.values());
}
