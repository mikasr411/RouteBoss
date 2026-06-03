import type { Customer } from "@/types/customer";
import { isCustomerDue } from "@/lib/utils";
import { pickPhoneNumber } from "@/lib/phone";

export type CityCustomerGroup = {
  city: string;
  customers: Customer[];
};

/** @deprecated Use CityCustomerGroup */
export type CityDueGroup = CityCustomerGroup & { dueCustomers: Customer[] };

export function customerHasPhone(customer: Customer): boolean {
  return !!pickPhoneNumber(customer);
}

/** No last service on file, but we have a number to text/call. */
export function isLostAndFoundCustomer(customer: Customer): boolean {
  return !customer.lastServiceDate && customerHasPhone(customer);
}

function groupCustomersByCity(
  customers: Customer[],
  include: (c: Customer) => boolean
): CityCustomerGroup[] {
  const map = new Map<string, Customer[]>();

  for (const c of customers) {
    if (!c.city?.trim() || !include(c)) continue;
    const city = c.city.trim();
    const list = map.get(city) ?? [];
    list.push(c);
    map.set(city, list);
  }

  return Array.from(map.entries())
    .map(([city, grouped]) => ({
      city,
      customers: [...grouped].sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

/** Due customers grouped by city (A–Z), names sorted within each city. */
export function groupDueCustomersByCity(customers: Customer[]): CityCustomerGroup[] {
  return groupCustomersByCity(customers, isCustomerDue);
}

/** Phone on file but no last service — grouped by city. */
export function groupLostAndFoundByCity(customers: Customer[]): CityCustomerGroup[] {
  return groupCustomersByCity(customers, isLostAndFoundCustomer);
}
