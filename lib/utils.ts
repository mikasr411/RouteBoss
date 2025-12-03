import { addMonths, parse, format, isBefore, isToday, isSameDay } from "date-fns";
import { Customer, ServiceFrequency } from "@/types/customer";

/**
 * Calculate next service date based on last service date and frequency
 */
export function calculateNextServiceDate(
  lastServiceDate: string | undefined,
  frequency: ServiceFrequency
): string | undefined {
  if (!lastServiceDate) return undefined;
  if (frequency === "OneTime") return undefined;

  try {
    const lastDate = parse(lastServiceDate, "yyyy-MM-dd", new Date());
    const monthsToAdd = frequency === "Quarterly" ? 3 : 6;
    const nextDate = addMonths(lastDate, monthsToAdd);
    return format(nextDate, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

/**
 * Check if a customer is due for service
 */
export function isCustomerDue(customer: Customer): boolean {
  if (!customer.nextServiceDate) return false;
  
  try {
    const nextDate = parse(customer.nextServiceDate, "yyyy-MM-dd", new Date());
    const today = new Date();
    return isBefore(nextDate, today) || isToday(nextDate) || isSameDay(nextDate, today);
  } catch {
    return false;
  }
}

/**
 * Skip this service cycle - move nextServiceDate forward by the interval
 */
export function skipServiceCycle(customer: Customer): Customer {
  if (!customer.nextServiceDate) return customer;

  try {
    const currentDate = parse(customer.nextServiceDate, "yyyy-MM-dd", new Date());
    const monthsToAdd = customer.serviceFrequency === "Quarterly" ? 3 : 6;
    const newDate = addMonths(currentDate, monthsToAdd);
    
    return {
      ...customer,
      nextServiceDate: format(newDate, "yyyy-MM-dd"),
    };
  } catch {
    return customer;
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—";
  
  try {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    return format(date, "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

/**
 * Parse lifetime value from string (remove $ and commas)
 */
export function parseLifetimeValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Build full address string
 */
export function buildFullAddress(
  street1: string,
  city: string,
  state: string,
  postalCode: string,
  street2?: string
): string {
  const parts = [street1];
  if (street2) parts.push(street2);
  parts.push(`${city}, ${state} ${postalCode}`);
  return parts.join(", ");
}

