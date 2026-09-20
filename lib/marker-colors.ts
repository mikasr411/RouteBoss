import { differenceInCalendarMonths, parse } from "date-fns";
import type { Customer } from "@/types/customer";

/** Status colors already used on the map (keep these exclusive). */
export const MARKER_CONTACTED = "#f97316";
export const MARKER_ON_ROUTE = "#10b981";
export const MARKER_LEAD = "#22c55e";
export const MARKER_OVERDUE = "#ef4444";

/**
 * Months since last service → unused palette, warm (just done) to ice (month 6).
 * 0 gold → 1 amber → 2 pink → 3 fuchsia → 4 violet → 5 indigo → 6 ice blue
 */
export const LAST_SERVICE_MONTH_COLORS = [
  "#eab308", // 0 — gold
  "#d97706", // 1 — amber
  "#ec4899", // 2 — pink
  "#d946ef", // 3 — fuchsia
  "#8b5cf6", // 4 — violet
  "#6366f1", // 5 — indigo
  "#7dd3fc", // 6 — ice blue
] as const;

export function monthsSinceLastService(
  lastServiceDate: string | undefined,
  asOfDate: string
): number | null {
  if (!lastServiceDate) return null;
  try {
    const last = parse(lastServiceDate, "yyyy-MM-dd", new Date());
    const asOf = parse(asOfDate, "yyyy-MM-dd", new Date());
    if (isNaN(last.getTime()) || isNaN(asOf.getTime())) return null;
    return Math.max(0, differenceInCalendarMonths(asOf, last));
  } catch {
    return null;
  }
}

export function lastServiceMonthColor(
  lastServiceDate: string | undefined,
  asOfDate: string
): string {
  const months = monthsSinceLastService(lastServiceDate, asOfDate);
  if (months == null) return MARKER_LEAD;
  if (months >= 7) return MARKER_OVERDUE;
  return LAST_SERVICE_MONTH_COLORS[Math.min(months, 6)];
}

export function getMarkerColor(customer: Customer, asOfDate: string): string {
  if (!customer.lastServiceDate && customer.leadContacted) return MARKER_CONTACTED;
  if (customer.isSelectedForRoute) return MARKER_ON_ROUTE;
  if (!customer.lastServiceDate) return MARKER_LEAD;
  return lastServiceMonthColor(customer.lastServiceDate, asOfDate);
}
