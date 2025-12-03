"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useEquipmentStore } from "@/store/equipment-store";
import { Reminder } from "@/types/equipment";
import { v4 as uuidv4 } from "uuid";
import { addMonths, format } from "date-fns";

export default function AddReminderPage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = params.id as string;
  const { equipment, addReminder } = useEquipmentStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const [formData, setFormData] = useState({
    name: "",
    reminderType: "hours" as "hours" | "date" | "both",
    dueHoursSinceService: "",
    dueDate: "",
    monthsAhead: "3",
  });

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <p className="text-slate-400">Equipment not found.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert("Please enter a reminder name");
      return;
    }

    const reminder: Reminder = {
      id: uuidv4(),
      equipmentId,
      name: formData.name,
    };

    if (formData.reminderType === "hours" || formData.reminderType === "both") {
      const hours = parseFloat(formData.dueHoursSinceService);
      if (isNaN(hours) || hours <= 0) {
        alert("Please enter a valid number of hours");
        return;
      }
      reminder.dueHoursSinceService = hours;
      reminder.lastResetAtHours = item.hoursTotal || 0;
    }

    if (formData.reminderType === "date" || formData.reminderType === "both") {
      if (formData.dueDate) {
        reminder.dueDate = formData.dueDate;
      } else {
        // Calculate date from months ahead
        const months = parseInt(formData.monthsAhead);
        const futureDate = addMonths(new Date(), months);
        reminder.dueDate = format(futureDate, "yyyy-MM-dd");
      }
    }

    addReminder(reminder);
    router.push(`/gear/equipment/${equipmentId}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-100">Add Reminder</h1>
        <p className="text-slate-400 mb-6">{item.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Reminder Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Oil Change"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Reminder Type
            </label>
            <select
              value={formData.reminderType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  reminderType: e.target.value as "hours" | "date" | "both",
                })
              }
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hours">Hours Based</option>
              <option value="date">Date Based</option>
              <option value="both">Both Hours & Date</option>
            </select>
          </div>

          {(formData.reminderType === "hours" ||
            formData.reminderType === "both") && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Due After Hours Since Service
              </label>
              <input
                type="number"
                step="0.1"
                required={
                  formData.reminderType === "hours" ||
                  formData.reminderType === "both"
                }
                value={formData.dueHoursSinceService}
                onChange={(e) =>
                  setFormData({ ...formData, dueHoursSinceService: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 50"
              />
              <p className="text-slate-500 text-xs mt-1">
                Current hours since service: {item.hoursSinceService || 0}
              </p>
            </div>
          )}

          {(formData.reminderType === "date" ||
            formData.reminderType === "both") && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Or set months ahead:</span>
                <input
                  type="number"
                  min="1"
                  value={formData.monthsAhead}
                  onChange={(e) =>
                    setFormData({ ...formData, monthsAhead: e.target.value })
                  }
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400 text-sm">months</span>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors"
            >
              Add Reminder
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

