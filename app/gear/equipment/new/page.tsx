"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEquipmentStore } from "@/store/equipment-store";
import { Equipment, EquipmentType, EquipmentStatus } from "@/types/equipment";
import { v4 as uuidv4 } from "uuid";

export default function NewEquipmentPage() {
  const router = useRouter();
  const { addEquipment } = useEquipmentStore();

  const [formData, setFormData] = useState<Partial<Equipment>>({
    name: "",
    type: "other",
    status: "active",
    hoursTotal: 0,
    hoursSinceService: 0,
  });

  const equipmentTypes: EquipmentType[] = [
    "truck",
    "trailer",
    "pressure_washer",
    "pump",
    "brush",
    "hose",
    "generator",
    "other",
  ];

  const statuses: EquipmentStatus[] = ["active", "spare", "retired", "sold"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEquipment: Equipment = {
      id: uuidv4(),
      name: formData.name || "Unnamed Equipment",
      type: formData.type || "other",
      status: formData.status || "active",
      serialNumber: formData.serialNumber,
      purchaseDate: formData.purchaseDate,
      purchasePrice: formData.purchasePrice,
      inServiceDate: formData.inServiceDate,
      hoursTotal: formData.hoursTotal || 0,
      hoursSinceService: formData.hoursSinceService || 0,
      notes: formData.notes,
    };

    addEquipment(newEquipment);
    router.push(`/gear/equipment/${newEquipment.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-6 text-slate-100">Add Equipment</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Landa ECOS 7000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as EquipmentType })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {equipmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as EquipmentStatus })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.serialNumber || ""}
              onChange={(e) =>
                setFormData({ ...formData, serialNumber: e.target.value })
              }
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchaseDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, purchaseDate: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Purchase Price
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.purchasePrice || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchasePrice: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              In Service Date
            </label>
            <input
              type="date"
              value={formData.inServiceDate || ""}
              onChange={(e) =>
                setFormData({ ...formData, inServiceDate: e.target.value })
              }
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Total Hours
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.hoursTotal || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hoursTotal: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Hours Since Service
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.hoursSinceService || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hoursSinceService: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors"
            >
              Add Equipment
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

