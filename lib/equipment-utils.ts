import { Equipment, ServiceRecord, Reminder } from "@/types/equipment";
import { getReminderStatus } from "./reminders";
import { format, parseISO } from "date-fns";

export function getTotalMaintenanceCost(
  equipment: Equipment,
  services: ServiceRecord[]
): number {
  const equipmentServices = services.filter(
    (s) => s.equipmentId === equipment.id
  );
  return equipmentServices.reduce((total, service) => {
    return total + (service.costParts || 0) + (service.costLabor || 0);
  }, 0);
}

export function getCostPerHour(
  equipment: Equipment,
  services: ServiceRecord[]
): number | null {
  const totalCost = getTotalMaintenanceCost(equipment, services);
  if (!equipment.hoursTotal || equipment.hoursTotal === 0) return null;
  return totalCost / equipment.hoursTotal;
}

export function getUpcomingServices(
  equipment: Equipment[],
  reminders: Reminder[],
  services: ServiceRecord[],
  daysAhead: number = 30
): Array<{
  equipment: Equipment;
  reminder: Reminder;
  status: ReturnType<typeof getReminderStatus>;
}> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + daysAhead);

  const upcoming: Array<{
    equipment: Equipment;
    reminder: Reminder;
    status: ReturnType<typeof getReminderStatus>;
  }> = [];

  equipment.forEach((eq) => {
    const eqReminders = reminders.filter((r) => r.equipmentId === eq.id);
    eqReminders.forEach((reminder) => {
      const status = getReminderStatus(reminder, eq, now);
      if (status.isDue || (status.daysUntilDue !== undefined && status.daysUntilDue <= daysAhead)) {
        upcoming.push({ equipment: eq, reminder, status });
      }
    });
  });

  // Sort by due date/hours (overdue first, then soonest)
  return upcoming.sort((a, b) => {
    if (a.status.isOverdue && !b.status.isOverdue) return -1;
    if (!a.status.isOverdue && b.status.isOverdue) return 1;
    
    const aDays = a.status.daysUntilDue ?? Infinity;
    const bDays = b.status.daysUntilDue ?? Infinity;
    return aDays - bDays;
  });
}

export function getLastServiceDate(
  equipment: Equipment,
  services: ServiceRecord[]
): string | undefined {
  const equipmentServices = services
    .filter((s) => s.equipmentId === equipment.id)
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateB.getTime() - dateA.getTime();
    });

  return equipmentServices[0]?.date;
}

export function formatEquipmentType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—";
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

