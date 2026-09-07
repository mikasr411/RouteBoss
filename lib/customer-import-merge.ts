import type { Customer } from "@/types/customer";
import { calculateNextServiceDate } from "@/lib/utils";
import { digitsForTel, pickPhoneNumber } from "@/lib/phone";

function phoneMatchKey(c: Customer): string | null {
  return digitsForTel(pickPhoneNumber(c));
}

function appendNotes(existing?: string, incoming?: string): string | undefined {
  const a = existing?.trim();
  const b = incoming?.trim();
  if (!a) return b;
  if (!b) return a;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}

/**
 * Merge a CSV-parsed row into an existing customer (same `id`, or phone match for leads).
 * CSV wins for exported fields; local enrichments are preserved.
 */
export function mergeImportedCustomer(
  existing: Customer,
  incoming: Customer,
  opts?: { preferExistingProfile?: boolean }
): Customer {
  const preferExisting = opts?.preferExistingProfile ?? false;
  const frequency = existing.serviceFrequency;

  const lastServiceDate = preferExisting
    ? existing.lastServiceDate ?? incoming.lastServiceDate
    : incoming.lastServiceDate ?? existing.lastServiceDate;

  const nextFromLast = calculateNextServiceDate(lastServiceDate, frequency);

  return {
    ...incoming,
    id: existing.id,
    displayName: preferExisting
      ? existing.displayName || incoming.displayName
      : incoming.displayName || existing.displayName,
    firstName: preferExisting
      ? existing.firstName ?? incoming.firstName
      : incoming.firstName ?? existing.firstName,
    lastName: preferExisting
      ? existing.lastName ?? incoming.lastName
      : incoming.lastName ?? existing.lastName,
    mobileNumber: incoming.mobileNumber || existing.mobileNumber,
    homeNumber: incoming.homeNumber || existing.homeNumber,
    email: incoming.email || existing.email,
    street1: preferExisting
      ? existing.street1 || incoming.street1
      : incoming.street1 || existing.street1,
    city: preferExisting ? existing.city || incoming.city : incoming.city || existing.city,
    state: preferExisting
      ? existing.state || incoming.state
      : incoming.state || existing.state,
    postalCode: preferExisting
      ? existing.postalCode || incoming.postalCode
      : incoming.postalCode || existing.postalCode,
    fullAddress: preferExisting
      ? existing.fullAddress || incoming.fullAddress
      : incoming.fullAddress || existing.fullAddress,
    lastServiceDate,
    serviceFrequency: frequency,
    nextServiceDate: nextFromLast ?? incoming.nextServiceDate ?? existing.nextServiceDate,
    lifetimeValue: existing.lifetimeValue ?? incoming.lifetimeValue,
    latitude:
      existing.latitude != null && !Number.isNaN(Number(existing.latitude))
        ? existing.latitude
        : incoming.latitude,
    longitude:
      existing.longitude != null && !Number.isNaN(Number(existing.longitude))
        ? existing.longitude
        : incoming.longitude,
    isSelectedForRoute: existing.isSelectedForRoute,
    notes: appendNotes(existing.notes, incoming.notes),
    leadSpecial: incoming.leadSpecial || existing.leadSpecial,
    leadSource: incoming.leadSource || existing.leadSource,
    panelCount: incoming.panelCount || existing.panelCount,
    storyType: incoming.storyType || existing.storyType,
  };
}

/**
 * Upsert imported rows by `id`. Facebook lead re-imports match on lead id.
 * When a lead shares a phone with an existing customer, merge into that contact
 * (keeps Housecall Pro id + service history).
 */
export function applyCustomerImportMerge(
  existingCustomers: Customer[],
  imported: Customer[]
): Customer[] {
  const byId = new Map(existingCustomers.map((c) => [c.id, { ...c }]));
  const phoneToId = new Map<string, string>();
  for (const c of existingCustomers) {
    const key = phoneMatchKey(c);
    if (key && !phoneToId.has(key)) phoneToId.set(key, c.id);
  }

  for (const incoming of imported) {
    const prevById = byId.get(incoming.id);
    if (prevById) {
      byId.set(incoming.id, mergeImportedCustomer(prevById, incoming));
      const key = phoneMatchKey(incoming);
      if (key) phoneToId.set(key, prevById.id);
      continue;
    }

    const phoneKey = phoneMatchKey(incoming);
    if (phoneKey && incoming.leadSource === "facebook") {
      const existingId = phoneToId.get(phoneKey);
      if (existingId) {
        const prev = byId.get(existingId);
        if (prev) {
          byId.set(
            existingId,
            mergeImportedCustomer(prev, incoming, { preferExistingProfile: true })
          );
          continue;
        }
      }
    }

    byId.set(incoming.id, { ...incoming });
    if (phoneKey) phoneToId.set(phoneKey, incoming.id);
  }

  return Array.from(byId.values());
}
