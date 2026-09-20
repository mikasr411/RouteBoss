import type { Customer } from "@/types/customer";
import { calculateNextServiceDate } from "@/lib/utils";
import { phoneMatchKeysForCustomer } from "@/lib/phone";
import {
  applyRecentServiceDone,
  laterServiceDate,
} from "@/lib/customer-lead-status";

function appendNotes(existing?: string, incoming?: string): string | undefined {
  const a = existing?.trim();
  const b = incoming?.trim();
  if (!a) return b;
  if (!b) return a;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}

function addressMatchKey(c: Customer): string | null {
  const street = (c.street1 || "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!street) return null;
  const zip = (c.postalCode || "").replace(/\D/g, "").slice(0, 5);
  const city = (c.city || "").toLowerCase().trim();
  if (zip.length === 5) return `${street}|${zip}`;
  if (city) return `${street}|${city}`;
  return null;
}

function indexPhones(phoneToId: Map<string, string>, customer: Customer) {
  for (const key of phoneMatchKeysForCustomer(customer)) {
    if (!phoneToId.has(key)) phoneToId.set(key, customer.id);
  }
}

function indexAddress(addressToId: Map<string, string>, customer: Customer) {
  const key = addressMatchKey(customer);
  if (key && !addressToId.has(key)) addressToId.set(key, customer.id);
}

function findMatchId(
  incoming: Customer,
  byId: Map<string, Customer>,
  phoneToId: Map<string, string>,
  addressToId: Map<string, string>
): string | undefined {
  if (byId.has(incoming.id)) return incoming.id;

  for (const key of phoneMatchKeysForCustomer(incoming)) {
    const existingId = phoneToId.get(key);
    if (existingId && byId.has(existingId)) return existingId;
  }

  const addr = addressMatchKey(incoming);
  if (addr) {
    const existingId = addressToId.get(addr);
    if (existingId && byId.has(existingId)) return existingId;
  }

  return undefined;
}

function pickSurvivor(group: Customer[]): Customer {
  return [...group].sort((a, b) => {
    const aHcp = a.leadSource === "housecallpro" ? 1 : 0;
    const bHcp = b.leadSource === "housecallpro" ? 1 : 0;
    if (aHcp !== bHcp) return bHcp - aHcp;
    const aServed = a.lastServiceDate ? 1 : 0;
    const bServed = b.lastServiceDate ? 1 : 0;
    if (aServed !== bServed) return bServed - aServed;
    const aRoute = a.isSelectedForRoute ? 1 : 0;
    const bRoute = b.isSelectedForRoute ? 1 : 0;
    if (aRoute !== bRoute) return bRoute - aRoute;
    return 0;
  })[0];
}

/**
 * Merge a CSV-parsed row into an existing customer (same `id`, phone, or address).
 * CSV wins for exported fields; local enrichments are preserved.
 */
export function mergeImportedCustomer(
  existing: Customer,
  incoming: Customer,
  opts?: { preferExistingProfile?: boolean }
): Customer {
  const preferExisting = opts?.preferExistingProfile ?? false;
  const frequency =
    incoming.leadSource === "housecallpro" && incoming.lastServiceDate
      ? incoming.serviceFrequency
      : existing.serviceFrequency;

  const lastServiceDate = laterServiceDate(
    existing.lastServiceDate,
    incoming.lastServiceDate
  );

  const nextFromLast = calculateNextServiceDate(lastServiceDate, frequency);

  const merged: Customer = {
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
    lifetimeValue: incoming.lifetimeValue ?? existing.lifetimeValue,
    latitude:
      existing.latitude != null && !Number.isNaN(Number(existing.latitude))
        ? existing.latitude
        : incoming.latitude,
    longitude:
      existing.longitude != null && !Number.isNaN(Number(existing.longitude))
        ? existing.longitude
        : incoming.longitude,
    isSelectedForRoute:
      existing.isSelectedForRoute || incoming.isSelectedForRoute,
    notes: appendNotes(existing.notes, incoming.notes),
    leadSpecial: incoming.leadSpecial || existing.leadSpecial,
    leadSource: incoming.leadSource || existing.leadSource,
    panelCount: incoming.panelCount || existing.panelCount,
    storyType: incoming.storyType || existing.storyType,
    leadContacted: existing.leadContacted || incoming.leadContacted,
    markedDoneOn: laterServiceDate(
      existing.markedDoneOn,
      incoming.markedDoneOn
    ),
    priorLastServiceDate:
      existing.priorLastServiceDate ?? incoming.priorLastServiceDate,
  };

  return applyRecentServiceDone(merged);
}

function collapseDuplicateCustomers(customers: Customer[]): Customer[] {
  const byId = new Map(customers.map((c) => [c.id, { ...c }]));

  const mergeGroup = (ids: string[]) => {
    const unique = [...new Set(ids)].filter((id) => byId.has(id));
    if (unique.length < 2) return;
    const records = unique.map((id) => byId.get(id)!);
    const survivor = pickSurvivor(records);
    let current = survivor;
    for (const other of records) {
      if (other.id === survivor.id) continue;
      current = mergeImportedCustomer(current, other, {
        preferExistingProfile: current.leadSource === "housecallpro",
      });
      byId.delete(other.id);
    }
    byId.set(survivor.id, current);
  };

  const phoneGroups = new Map<string, string[]>();
  for (const c of byId.values()) {
    for (const key of phoneMatchKeysForCustomer(c)) {
      const arr = phoneGroups.get(key) ?? [];
      arr.push(c.id);
      phoneGroups.set(key, arr);
    }
  }
  for (const ids of phoneGroups.values()) mergeGroup(ids);

  const addressGroups = new Map<string, string[]>();
  for (const c of byId.values()) {
    const key = addressMatchKey(c);
    if (!key) continue;
    const arr = addressGroups.get(key) ?? [];
    arr.push(c.id);
    addressGroups.set(key, arr);
  }
  for (const ids of addressGroups.values()) mergeGroup(ids);

  return Array.from(byId.values());
}

/**
 * Upsert imported rows by `id`, phone, or address.
 * Housecall Pro rows update Facebook specials (and vice versa) so service
 * dates land on the same person. Duplicates already in the list are collapsed.
 */
export function applyCustomerImportMerge(
  existingCustomers: Customer[],
  imported: Customer[]
): Customer[] {
  const byId = new Map(existingCustomers.map((c) => [c.id, { ...c }]));
  const phoneToId = new Map<string, string>();
  const addressToId = new Map<string, string>();
  for (const c of existingCustomers) {
    indexPhones(phoneToId, c);
    indexAddress(addressToId, c);
  }

  for (const incoming of imported) {
    const matchId = findMatchId(incoming, byId, phoneToId, addressToId);
    if (matchId) {
      const prev = byId.get(matchId);
      if (prev) {
        const preferExistingProfile =
          prev.leadSource === "housecallpro" &&
          incoming.leadSource === "facebook";
        const merged = mergeImportedCustomer(prev, incoming, {
          preferExistingProfile,
        });
        byId.set(matchId, merged);
        indexPhones(phoneToId, merged);
        indexAddress(addressToId, merged);
        continue;
      }
    }

    const added = applyRecentServiceDone({ ...incoming });
    byId.set(added.id, added);
    indexPhones(phoneToId, added);
    indexAddress(addressToId, added);
  }

  return collapseDuplicateCustomers(Array.from(byId.values()));
}
