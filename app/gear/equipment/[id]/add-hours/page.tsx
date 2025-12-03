"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useEquipmentStore } from "@/store/equipment-store";

export default function AddHoursPage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = params.id as string;
  const { equipment, addHours } = useEquipmentStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const [hours, setHours] = useState("");

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
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      alert("Please enter a valid number of hours");
      return;
    }

    addHours(equipmentId, hoursNum);
    router.push(`/gear/equipment/${equipmentId}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-100">Add Hours</h1>
        <p className="text-slate-400 mb-6">{item.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Hours to Add <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 3.5"
              autoFocus
            />
            <p className="text-slate-500 text-sm mt-1">
              Current total: {item.hoursTotal?.toLocaleString() || 0} hours
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold transition-colors"
            >
              Add Hours
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

