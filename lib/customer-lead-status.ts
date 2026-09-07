import type { Customer } from "@/types/customer";
import { calculateNextServiceDate } from "@/lib/utils";

export function isCustomerDoneOnDate(
  customer: Customer,
  dateKey: string
): boolean {
  return customer.markedDoneOn === dateKey;
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
