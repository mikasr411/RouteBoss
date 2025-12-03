import { Customer } from "@/types/customer";
import { format, parse, differenceInCalendarDays } from "date-fns";

export type TemplateVariables = {
  displayName: string;
  fullAddress: string;
  city: string;
  state: string;
  mobileNumber: string;
  lastServiceDate: string;
  nextServiceDate: string;
  daysSinceLastService: string;
};

/**
 * Build template variables from a customer
 */
export function buildTemplateVariables(customer: Customer): TemplateVariables {
  let lastServiceDateFormatted = "";
  let daysSinceLastService = "";
  let nextServiceDateFormatted = "";

  // Format last service date
  if (customer.lastServiceDate) {
    try {
      const lastDate = parse(customer.lastServiceDate, "yyyy-MM-dd", new Date());
      lastServiceDateFormatted = format(lastDate, "MMM d, yyyy");
      
      // Calculate days since last service
      const today = new Date();
      const daysDiff = differenceInCalendarDays(today, lastDate);
      daysSinceLastService = daysDiff.toString();
    } catch {
      // Invalid date, leave empty
    }
  }

  // Format next service date
  if (customer.nextServiceDate) {
    try {
      const nextDate = parse(customer.nextServiceDate, "yyyy-MM-dd", new Date());
      nextServiceDateFormatted = format(nextDate, "MMM d, yyyy");
    } catch {
      // Invalid date, leave empty
    }
  }

  return {
    displayName: customer.displayName || "",
    fullAddress: customer.fullAddress || "",
    city: customer.city || "",
    state: customer.state || "",
    mobileNumber: customer.mobileNumber || "",
    lastServiceDate: lastServiceDateFormatted,
    nextServiceDate: nextServiceDateFormatted,
    daysSinceLastService,
  };
}

/**
 * Apply a template string to template variables
 * Replaces {variableName} with the corresponding value
 */
export function applyTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? value : "";
  });
}

/**
 * Default message template
 */
export const DEFAULT_TEMPLATE = `Hey {displayName}, it's been {daysSinceLastService} days since we last cleaned your solar panels at {fullAddress}. 

We're switching to a semi-automated system for scheduling routes in your neighborhood and we'll be in your area soon. 

Reply YES to confirm you'd like to be added to this route.`;

