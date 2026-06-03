import type { Customer } from "@/types/customer";
import { isCustomerDue } from "@/lib/utils";

export type CityDueGroup = {
  city: string;
  dueCustomers: Customer[];
};

/** Due customers grouped by city (A–Z), names sorted within each city. */
export function groupDueCustomersByCity(customers: Customer[]): CityDueGroup[] {
  const map = new Map<string, Customer[]>();

  for (const c of customers) {
    if (!c.city?.trim() || !isCustomerDue(c)) continue;
    const city = c.city.trim();
    const list = map.get(city) ?? [];
    list.push(c);
    map.set(city, list);
  }

  return Array.from(map.entries())
    .map(([city, dueCustomers]) => ({
      city,
      dueCustomers: [...dueCustomers].sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));
}
