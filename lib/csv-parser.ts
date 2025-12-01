import Papa from "papaparse";
import { Customer } from "@/types/customer";
import { buildFullAddress, parseLifetimeValue, calculateNextServiceDate } from "./utils";
import { parse, format } from "date-fns";

export interface HousecallProRow {
  "First Name"?: string;
  "Last Name"?: string;
  "Display Name": string;
  "Mobile Number"?: string;
  "Home Number"?: string;
  "Email"?: string;
  "Additional Emails"?: string;
  "Company"?: string;
  "Role"?: string;
  "Work Number"?: string;
  "ID": string;
  "Last service date"?: string;
  "Lifetime value"?: string;
  "Address_1 Street Line 1": string;
  "Address_1 Street Line 2"?: string;
  "Address_1 City": string;
  "Address_1 State": string;
  "Address_1 Postal Code": string;
  "Address_1 Billing?"?: string;
  "Address_1 Notes"?: string;
  [key: string]: string | undefined;
}

/**
 * Parse a date string from Housecall Pro format to ISO (yyyy-MM-dd)
 */
function parseServiceDate(dateStr: string | undefined): string | undefined {
  if (!dateStr || dateStr.trim() === "") return undefined;

  // Try common date formats
  const formats = [
    "MM/dd/yyyy",
    "yyyy-MM-dd",
    "MM-dd-yyyy",
    "M/d/yyyy",
    "yyyy/MM/dd",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(dateStr, fmt, new Date());
      if (!isNaN(parsed.getTime())) {
        return format(parsed, "yyyy-MM-dd");
      }
    } catch {
      continue;
    }
  }

  // If all parsing fails, try native Date parsing
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  } catch {
    // Ignore
  }

  return undefined;
}

/**
 * Convert a Housecall Pro CSV row to a Customer
 */
export function rowToCustomer(row: HousecallProRow): Customer {
  const street1 = row["Address_1 Street Line 1"] || "";
  const city = row["Address_1 City"] || "";
  const state = row["Address_1 State"] || "";
  const postalCode = row["Address_1 Postal Code"] || "";
  const street2 = row["Address_1 Street Line 2"];

  const lastServiceDate = parseServiceDate(row["Last service date"]);
  const serviceFrequency: "Biannual" = "Biannual"; // Default

  const customer: Customer = {
    id: row["ID"] || `temp-${Date.now()}-${Math.random()}`,
    firstName: row["First Name"],
    lastName: row["Last Name"],
    displayName: row["Display Name"] || `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim() || "Unknown",
    mobileNumber: row["Mobile Number"],
    homeNumber: row["Home Number"],
    email: row["Email"],
    company: row["Company"],
    lastServiceDate,
    lifetimeValue: parseLifetimeValue(row["Lifetime value"]),
    street1,
    street2,
    city,
    state,
    postalCode,
    addressNotes: row["Address_1 Notes"],
    fullAddress: buildFullAddress(street1, city, state, postalCode, street2),
    serviceFrequency,
    nextServiceDate: calculateNextServiceDate(lastServiceDate, serviceFrequency),
    isSelectedForRoute: false,
  };

  return customer;
}

/**
 * Parse CSV file and convert to Customer array
 */
export function parseCSV(file: File): Promise<Customer[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<HousecallProRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parsing errors:", results.errors);
        }

        const customers = results.data
          .filter((row) => row["ID"] && row["Address_1 Street Line 1"]) // Must have ID and address
          .map(rowToCustomer);

        resolve(customers);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

