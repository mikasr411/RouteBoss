import type { Customer } from "@/types/customer";
import { calculateNextServiceDate } from "@/lib/utils";
import { differenceInCalendarDays, format, parse } from "date-fns";

/** Housecall last-service dates in this window count as Done. */
export const RECENT_SERVICE_DONE_DAYS = 30;

export function isServicedRecently(
  lastServiceDate: string | undefined,
  asOfDate: string,
  withinDays: number = RECENT_SERVICE_DONE_DAYS
): boolean {
  if (!lastServiceDate) return false;
  try {
    const last = parse(lastServiceDate, "yyyy-MM-dd", new Date());
    const asOf = parse(asOfDate, "yyyy-MM-dd", new Date());
    if (isNaN(last.getTime()) || isNaN(asOf.getTime())) return false;
    const diff = differenceInCalendarDays(asOf, last);
    return diff >= 0 && diff <= withinDays;
  } catch {
    return false;
  }
}

export function isCustomerDoneOnDate(
  customer: Customer,
  dateKey: string
): boolean {
  if (customer.markedDoneOn === dateKey) return true;
  return isServicedRecently(customer.lastServiceDate, dateKey);
}

export function laterServiceDate(
  a?: string,
  b?: string
): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function applyRecentServiceDone(
  customer: Customer,
  asOfDate: string = format(new Date(), "yyyy-MM-dd")
): Customer {
  if (!isServicedRecently(customer.lastServiceDate, asOfDate)) {
    return customer;
  }
  const serviceDate = customer.lastServiceDate!;
  const markedDoneOn =
    customer.markedDoneOn && customer.markedDoneOn >= serviceDate
      ? customer.markedDoneOn
      : serviceDate;
  return {
    ...customer,
    markedDoneOn,
    leadContacted: true,
  };
}

export function patchMarkCustomerDone(
  customer: Customer,
  dateKey: string
): Partial<Customer> {
  const patch: Partial<Customer> = {
    markedDoneOn: dateKey,
    lastServiceDate: dateKey,
    nextServiceDate: calculateNextServiceDate(
      dateKey,
      customer.serviceFrequency
    ),
    leadContacted: true,
  };
  if (customer.lastServiceDate && customer.lastServiceDate !== dateKey) {
    patch.priorLastServiceDate = customer.lastServiceDate;
  }
  return patch;
}

export function patchUndoCustomerDone(
  customer: Customer
): Partial<Customer> {
  const restoreDate = customer.priorLastServiceDate;
  return {
    markedDoneOn: undefined,
    priorLastServiceDate: undefined,
    lastServiceDate: restoreDate,
    nextServiceDate: restoreDate
      ? calculateNextServiceDate(restoreDate, customer.serviceFrequency)
      : undefined,
  };
}
