import { Reminder, Equipment } from "@/types/equipment";

export function isReminderDue(
  reminder: Reminder,
  equipment: Equipment,
  now: Date = new Date()
): boolean {
  // Check if due by date
  const dueByDate =
    reminder.dueDate && new Date(reminder.dueDate) <= now;

  // Check if due by hours
  const dueByHours =
    reminder.dueHoursSinceService !== undefined &&
    equipment.hoursSinceService !== undefined &&
    equipment.hoursSinceService >= reminder.dueHoursSinceService;

  return dueByDate || dueByHours;
}

export function getReminderStatus(
  reminder: Reminder,
  equipment: Equipment,
  now: Date = new Date()
): {
  isDue: boolean;
  daysUntilDue?: number;
  hoursUntilDue?: number;
  isOverdue: boolean;
} {
  const isDue = isReminderDue(reminder, equipment, now);
  
  let daysUntilDue: number | undefined;
  let hoursUntilDue: number | undefined;
  let isOverdue = false;

  if (reminder.dueDate) {
    const dueDate = new Date(reminder.dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    daysUntilDue = diffDays;
    isOverdue = diffDays < 0;
  }

  if (
    reminder.dueHoursSinceService !== undefined &&
    equipment.hoursSinceService !== undefined
  ) {
    const hoursRemaining =
      reminder.dueHoursSinceService - equipment.hoursSinceService;
    hoursUntilDue = hoursRemaining;
    isOverdue = hoursRemaining < 0;
  }

  return {
    isDue,
    daysUntilDue,
    hoursUntilDue,
    isOverdue,
  };
}

