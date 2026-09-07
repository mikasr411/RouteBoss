import Papa from "papaparse";
import { Customer } from "@/types/customer";
import {
  buildFullAddress,
  parseLifetimeValue,
  calculateNextServiceDate,
} from "./utils";
import { formatPhoneDisplay } from "./phone";
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
  ID: string;
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

/** Meta / Facebook lead export (tab-separated) */
export interface FacebookLeadRow {
  id?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  street_address?: string;
  city?: string;
  ad_name?: string;
  created_time?: string;
  platform?: string;
  form_name?: string;
  "i_want_1$_per_panel_special"?: string;
  "do_you_want_the_next_available_appointment?"?: string;
  "best_time_to_contact?"?: string;
  "best_way_to_contact?"?: string;
  "single_story_or_two-story?"?: string;
  "how_many_panels_if_you_know?"?: string;
  [key: string]: string | undefined;
}

export type ImportFormat = "housecallpro" | "facebook";

/**
 * Parse a date string from Housecall Pro format to ISO (yyyy-MM-dd)
 */
function parseServiceDate(dateStr: string | undefined): string | undefined {
  if (!dateStr || dateStr.trim() === "") return undefined;

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

/** Meta exports phones like `p:+14082046748` */
export function parseFacebookPhone(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  let s = raw.trim();
  if (s.startsWith("p:")) s = s.slice(2);
  const display = formatPhoneDisplay(s);
  return display || s;
}

/** Pull state + zip from a free-form address when present */
export function parseAddressParts(streetRaw: string): {
  street1: string;
  state: string;
  postalCode: string;
} {
  let street1 = streetRaw.trim();
  let state = "CA";
  let postalCode = "";

  const stateZip = street1.match(
    /\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/
  );
  if (stateZip) {
    state = stateZip[1].toUpperCase();
    postalCode = stateZip[2];
    street1 = street1.slice(0, stateZip.index).trim().replace(/,\s*$/, "");
  } else {
    const zipOnly = street1.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    if (zipOnly) {
      postalCode = zipOnly[1];
      street1 = street1.slice(0, zipOnly.index).trim().replace(/,\s*$/, "");
    }
    const stateOnly = street1.match(/\b(CA|California)\s*$/i);
    if (stateOnly) {
      state = "CA";
      street1 = street1.slice(0, stateOnly.index).trim().replace(/,\s*$/, "");
    }
  }

  return { street1, state, postalCode };
}

function buildFacebookLeadNotes(row: FacebookLeadRow): string | undefined {
  const parts: string[] = [];
  const panels = row["how_many_panels_if_you_know?"]?.trim();
  const story = row["single_story_or_two-story?"]?.trim();
  const contactTime = row["best_time_to_contact?"]?.trim();
  const contactWay = row["best_way_to_contact?"]?.trim();
  const appt = row["do_you_want_the_next_available_appointment?"]?.trim();
  const special = row["i_want_1$_per_panel_special"]?.trim();

  if (panels) parts.push(`Panels: ${panels}`);
  if (story) parts.push(`Story: ${story}`);
  if (contactTime) parts.push(`Best time: ${contactTime}`);
  if (contactWay) parts.push(`Contact via: ${contactWay}`);
  if (appt) parts.push(`Next appt: ${appt}`);
  if (special) parts.push(`$1 special: ${special}`);
  if (row.platform?.trim()) parts.push(`Platform: ${row.platform.trim()}`);
  if (row.created_time?.trim()) {
    parts.push(`Lead date: ${row.created_time.trim()}`);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function detectImportFormat(
  headers: string[]
): ImportFormat | null {
  const h = new Set(headers.map((x) => x.trim().toLowerCase()));
  if (h.has("address_1 street line 1") && h.has("display name")) {
    return "housecallpro";
  }
  if (h.has("full_name") && h.has("phone_number") && h.has("street_address")) {
    return "facebook";
  }
  return null;
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
  const serviceFrequency: "Biannual" = "Biannual";

  const customer: Customer = {
    id: row["ID"] || `temp-${Date.now()}-${Math.random()}`,
    firstName: row["First Name"],
    lastName: row["Last Name"],
    displayName:
      row["Display Name"] ||
      `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim() ||
      "Unknown",
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
    leadSource: "housecallpro",
  };

  return customer;
}

/**
 * Convert a Meta / Facebook lead export row to a Customer
 */
export function facebookRowToCustomer(row: FacebookLeadRow): Customer {
  const streetRaw = (row.street_address || "").trim();
  const { street1, state, postalCode } = parseAddressParts(streetRaw);
  const city = (row.city || "").trim();
  const displayName = (row.full_name || "").trim() || "Unknown";
  const nameParts = displayName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const customer: Customer = {
    id: row.id?.trim() || `fb-${Date.now()}-${Math.random()}`,
    firstName,
    lastName,
    displayName,
    mobileNumber: parseFacebookPhone(row.phone_number),
    email: row.email?.trim() || undefined,
    street1: street1 || streetRaw,
    city,
    state,
    postalCode,
    fullAddress: buildFullAddress(
      street1 || streetRaw,
      city,
      state,
      postalCode
    ),
    serviceFrequency: "OneTime",
    notes: buildFacebookLeadNotes(row),
    isSelectedForRoute: false,
    leadSource: "facebook",
    leadSpecial: row.ad_name?.replace(/^"|"$/g, "").trim() || undefined,
  };

  return customer;
}

function parseRowsToCustomers(
  rows: Record<string, string | undefined>[],
  format: ImportFormat
): Customer[] {
  if (format === "housecallpro") {
    return rows
      .filter((row) => row["ID"] && row["Address_1 Street Line 1"])
      .map((row) => rowToCustomer(row as HousecallProRow));
  }
  return rows
    .filter((row) => row.id && (row.street_address || row.city))
    .map((row) => facebookRowToCustomer(row as FacebookLeadRow));
}

/**
 * Parse CSV/TSV file and convert to Customer array (Housecall Pro or Facebook leads)
 */
export function parseCSV(file: File): Promise<Customer[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parsing errors:", results.errors);
        }

        const headers = results.meta.fields ?? [];
        const format = detectImportFormat(headers);
        if (!format) {
          reject(
            new Error(
              "Unrecognized file format. Expected Housecall Pro export or Meta/Facebook leads export."
            )
          );
          return;
        }

        const customers = parseRowsToCustomers(results.data, format);
        resolve(customers);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/** Unique campaign / special names on imported customers */
export function listLeadSpecials(customers: Customer[]): string[] {
  const set = new Set<string>();
  for (const c of customers) {
    if (c.leadSpecial?.trim()) set.add(c.leadSpecial.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
