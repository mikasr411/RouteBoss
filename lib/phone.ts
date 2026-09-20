/**
 * Normalize a phone string for tel:/sms: hrefs (digits only).
 */
export function digitsForTel(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/**
 * US-style match key so +14085551212 and (408) 555-1212 hit the same person.
 */
export function normalizePhoneMatchKey(
  raw: string | undefined | null
): string | null {
  const d = digitsForTel(raw);
  if (!d) return null;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length > 10) return d.slice(-10);
  return d;
}

export function phoneMatchKeysForCustomer(c: {
  mobileNumber?: string;
  homeNumber?: string;
}): string[] {
  const keys = new Set<string>();
  const mobile = normalizePhoneMatchKey(c.mobileNumber);
  const home = normalizePhoneMatchKey(c.homeNumber);
  if (mobile) keys.add(mobile);
  if (home) keys.add(home);
  return Array.from(keys);
}

/**
 * Prefer mobile, then home landline.
 */
export function pickPhoneNumber(c: {
  mobileNumber?: string;
  homeNumber?: string;
}): string | undefined {
  return c.mobileNumber?.trim() || c.homeNumber?.trim() || undefined;
}

/**
 * Human-friendly display; falls back to trimmed original if pattern unknown.
 */
export function formatPhoneDisplay(raw: string | undefined | null): string {
  if (!raw?.trim()) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11 && d.startsWith("1")) {
    const r = d.slice(1);
    return `+1 (${r.slice(0, 3)}) ${r.slice(3, 6)}-${r.slice(6)}`;
  }
  return raw.trim();
}
