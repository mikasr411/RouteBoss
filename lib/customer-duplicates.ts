import type { Customer } from "@/types/customer";
import { phoneMatchKeysForCustomer } from "@/lib/phone";
import { addressMatchKey } from "@/lib/customer-import-merge";

export type DuplicateGroup = {
  key: string;
  members: Customer[];
  reasons: string[];
};

function lastNameKey(c: Customer): string {
  const raw =
    c.lastName?.trim() ||
    c.displayName.trim().split(/\s+/).slice(-1)[0] ||
    "";
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

function streetNumber(c: Customer): string | null {
  const m = (c.street1 || "").trim().match(/^(\d+[a-z]?)/i);
  return m ? m[1].toLowerCase() : null;
}

function cityKey(c: Customer): string {
  return (c.city || "").toLowerCase().trim();
}

class UnionFind {
  parent = new Map<string, string>();

  find(id: string): string {
    const p = this.parent.get(id) ?? id;
    if (p !== id) {
      const root = this.find(p);
      this.parent.set(id, root);
      return root;
    }
    this.parent.set(id, id);
    return id;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function pairReasons(a: Customer, b: Customer): string[] {
  const reasons: string[] = [];
  const phonesA = new Set(phoneMatchKeysForCustomer(a));
  const phonesB = phoneMatchKeysForCustomer(b);
  if (phonesB.some((p) => phonesA.has(p))) reasons.push("same phone");

  const addrA = addressMatchKey(a);
  const addrB = addressMatchKey(b);
  if (addrA && addrB && addrA === addrB) reasons.push("same address");

  const lastA = lastNameKey(a);
  const lastB = lastNameKey(b);
  const cityA = cityKey(a);
  const cityB = cityKey(b);
  const numA = streetNumber(a);
  const numB = streetNumber(b);
  if (
    lastA.length >= 3 &&
    lastA === lastB &&
    cityA &&
    cityA === cityB &&
    numA &&
    numA === numB
  ) {
    reasons.push("same name + street #");
  }

  return reasons;
}

export function duplicateGroupKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

/**
 * Groups that look like the same person: shared phone, exact address,
 * or same last name + city + street number.
 */
export function findDuplicateGroups(
  customers: Customer[],
  dismissedKeys: string[] = []
): DuplicateGroup[] {
  const dismissed = new Set(dismissedKeys);
  const uf = new UnionFind();

  const phoneBuckets = new Map<string, string[]>();
  const addressBuckets = new Map<string, string[]>();

  for (const c of customers) {
    for (const phone of phoneMatchKeysForCustomer(c)) {
      const arr = phoneBuckets.get(phone) ?? [];
      arr.push(c.id);
      phoneBuckets.set(phone, arr);
    }
    const addr = addressMatchKey(c);
    if (addr) {
      const arr = addressBuckets.get(addr) ?? [];
      arr.push(c.id);
      addressBuckets.set(addr, arr);
    }
  }

  for (const ids of phoneBuckets.values()) {
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
  }
  for (const ids of addressBuckets.values()) {
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
  }

  const nameBuckets = new Map<string, Customer[]>();
  for (const c of customers) {
    const last = lastNameKey(c);
    const city = cityKey(c);
    const num = streetNumber(c);
    if (last.length < 3 || !city || !num) continue;
    const key = `${last}|${city}|${num}`;
    const arr = nameBuckets.get(key) ?? [];
    arr.push(c);
    nameBuckets.set(key, arr);
  }
  for (const group of nameBuckets.values()) {
    for (let i = 1; i < group.length; i++) uf.union(group[0].id, group[i].id);
  }

  const clusters = new Map<string, Customer[]>();
  for (const c of customers) {
    const root = uf.parent.has(c.id) ? uf.find(c.id) : c.id;
    if (!uf.parent.has(c.id)) continue;
    const arr = clusters.get(root) ?? [];
    arr.push(c);
    clusters.set(root, arr);
  }

  const groups: DuplicateGroup[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const key = duplicateGroupKey(members.map((m) => m.id));
    if (dismissed.has(key)) continue;

    const reasonSet = new Set<string>();
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        for (const r of pairReasons(members[i], members[j])) reasonSet.add(r);
      }
    }
    if (reasonSet.size === 0) continue;

    groups.push({
      key,
      members: members.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
      reasons: Array.from(reasonSet),
    });
  }

  groups.sort((a, b) => {
    const aPhone = a.reasons.includes("same phone") ? 0 : 1;
    const bPhone = b.reasons.includes("same phone") ? 0 : 1;
    if (aPhone !== bPhone) return aPhone - bPhone;
    return b.members.length - a.members.length;
  });

  return groups;
}

export function suggestedKeepId(members: Customer[]): string {
  const ranked = [...members].sort((a, b) => {
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
  });
  return ranked[0]?.id ?? members[0].id;
}

export function remapCustomerIdList(
  ids: string[],
  absorbIds: string[],
  keepId: string
): string[] {
  const absorb = new Set(absorbIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const next = absorb.has(id) ? keepId : id;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}
