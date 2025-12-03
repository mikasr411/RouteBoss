import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Equipment, ServiceRecord, Reminder } from "@/types/equipment";

interface EquipmentStore {
  equipment: Equipment[];
  services: ServiceRecord[];
  reminders: Reminder[];

  // Equipment actions
  addEquipment: (equipment: Equipment) => void;
  updateEquipment: (id: string, patch: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;

  // Service actions
  addService: (service: ServiceRecord) => void;
  updateService: (id: string, patch: Partial<ServiceRecord>) => void;
  deleteService: (id: string) => void;
  getServicesForEquipment: (equipmentId: string) => ServiceRecord[];

  // Reminder actions
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  getRemindersForEquipment: (equipmentId: string) => Reminder[];

  // Utility actions
  addHours: (equipmentId: string, hours: number) => void;
  logServiceAndResetHours: (
    equipmentId: string,
    service: ServiceRecord
  ) => void;
}

const STORAGE_KEY = "gearGarage:data";

export const useEquipmentStore = create<EquipmentStore>()(
  persist(
    (set, get) => ({
      equipment: [],
      services: [],
      reminders: [],

      addEquipment: (equipment) =>
        set((state) => ({
          equipment: [...state.equipment, equipment],
        })),

      updateEquipment: (id, patch) =>
        set((state) => ({
          equipment: state.equipment.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        })),

      deleteEquipment: (id) =>
        set((state) => ({
          equipment: state.equipment.filter((e) => e.id !== id),
          services: state.services.filter((s) => s.equipmentId !== id),
          reminders: state.reminders.filter((r) => r.equipmentId !== id),
        })),

      addService: (service) =>
        set((state) => ({
          services: [...state.services, service],
        })),

      updateService: (id, patch) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, ...patch } : s
          ),
        })),

      deleteService: (id) =>
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        })),

      getServicesForEquipment: (equipmentId) => {
        return get().services.filter((s) => s.equipmentId === equipmentId);
      },

      addReminder: (reminder) =>
        set((state) => ({
          reminders: [...state.reminders, reminder],
        })),

      updateReminder: (id, patch) =>
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, ...patch } : r
          ),
        })),

      deleteReminder: (id) =>
        set((state) => ({
          reminders: state.reminders.filter((r) => r.id !== id),
        })),

      getRemindersForEquipment: (equipmentId) => {
        return get().reminders.filter((r) => r.equipmentId === equipmentId);
      },

      addHours: (equipmentId, hours) => {
        const equipment = get().equipment.find((e) => e.id === equipmentId);
        if (!equipment) return;

        set((state) => ({
          equipment: state.equipment.map((e) =>
            e.id === equipmentId
              ? {
                  ...e,
                  hoursTotal: (e.hoursTotal || 0) + hours,
                  hoursSinceService: (e.hoursSinceService || 0) + hours,
                }
              : e
          ),
        }));
      },

      logServiceAndResetHours: (equipmentId, service) => {
        const equipment = get().equipment.find((e) => e.id === equipmentId);
        if (!equipment) return;

        // Add the service
        get().addService(service);

        // Update equipment hours
        set((state) => ({
          equipment: state.equipment.map((e) =>
            e.id === equipmentId
              ? {
                  ...e,
                  hoursSinceService: 0,
                  hoursTotal: service.hoursAtService || e.hoursTotal || 0,
                }
              : e
          ),
          // Update reminders that were reset
          reminders: state.reminders.map((r) =>
            r.equipmentId === equipmentId
              ? {
                  ...r,
                  lastResetAtHours: service.hoursAtService || equipment.hoursTotal || 0,
                }
              : r
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

