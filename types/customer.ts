export type ServiceFrequency = "OneTime" | "Biannual" | "Quarterly";

export type Customer = {
  id: string;                // from "ID"
  firstName?: string;        // "First Name"
  lastName?: string;         // "Last Name"
  displayName: string;       // "Display Name"
  mobileNumber?: string;     // "Mobile Number"
  homeNumber?: string;       // "Home Number"
  email?: string;            // "Email"
  company?: string;          // "Company"
  lastServiceDate?: string;  // parsed from "Last service date" (store ISO: yyyy-MM-dd if possible)
  lifetimeValue?: number;    // from "Lifetime value" (strip $ and commas)
  street1: string;           // "Address_1 Street Line 1"
  street2?: string;          // "Address_1 Street Line 2"
  city: string;              // "Address_1 City"
  state: string;             // "Address_1 State"
  postalCode: string;        // "Address_1 Postal Code"
  addressNotes?: string;     // "Address_1 Notes"
  fullAddress: string;       // computed: "street1, city, state postalCode"
  serviceFrequency: ServiceFrequency; // default "Biannual" (6 months)
  nextServiceDate?: string;  // ISO string; computed from lastServiceDate + frequency, but editable in UI
  notes?: string;            // free text notes (optional)
  isSelectedForRoute?: boolean; // used for route selection
  latitude?: number | null;  // geocoded latitude
  longitude?: number | null; // geocoded longitude
};

