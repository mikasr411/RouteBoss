export type EquipmentType =
  | "truck"
  | "trailer"
  | "pressure_washer"
  | "pump"
  | "brush"
  | "hose"
  | "generator"
  | "other";

export type EquipmentStatus = "active" | "spare" | "retired" | "sold";

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  serialNumber?: string;
  purchaseDate?: string; // ISO date
  purchasePrice?: number;
  inServiceDate?: string; // ISO date
  hoursTotal?: number;
  hoursSinceService?: number;
  notes?: string;
}

export type ServiceType =
  | "oil_change"
  | "pump_seals"
  | "new_hose"
  | "tire_rotation"
  | "brakes"
  | "general_inspection"
  | "other";

export interface ServiceRecord {
  id: string;
  equipmentId: string;
  date: string; // ISO date
  serviceType: ServiceType;
  description: string;
  costParts?: number;
  costLabor?: number;
  hoursAtService?: number;
}

export interface Reminder {
  id: string;
  equipmentId: string;
  name: string;
  dueDate?: string; // ISO date
  dueHoursSinceService?: number;
  lastResetAtHours?: number;
}

