"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useEquipmentStore } from "@/store/equipment-store";
import { ServiceRecord, ServiceType } from "@/types/equipment";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

export default function LogServicePage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = params.id as string;
  const { equipment, logServiceAndResetHours } = useEquipmentStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const [formData, setFormData] = useState<Partial<ServiceRecord>>({
    date: format(new Date(), "yyyy-MM-dd"),
    serviceType: "other",
    description: "",
    hoursAtService: item?.hoursTotal || 0,
  });

  const serviceTypes: ServiceType[] = [
    "oil_change",
    "pump_seals",
    "new_hose",
    "tire_rotation",
    "brakes",
    "general_inspection",
    "other",
  ];

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
    if (!formData.description) {
      alert("Please enter a description");
      return;
    }

    const service: ServiceRecord = {
      id: uuidv4(),
      equipmentId,
      date: formData.date || format(new Date(), "yyyy-MM-dd"),
      serviceType: formData.serviceType || "other",
      description: formData.description,
      costParts: formData.costParts,
      costLabor: formData.costLabor,
      hoursAtService: formData.hoursAtService,
    };

    logServiceAndResetHours(equipmentId, service);
    router.push(`/gear/equipment/${equipmentId}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-100">Log Service</h1>
        <p className="text-slate-400 mb-6">{item.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Service Type</label>
            <select
              value={formData.serviceType}
              onChange={(e) =>
                setFormData({ ...formData, serviceType: e.target.value as ServiceType })
              }
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {serviceTypes.map((type) => (
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
            <label className="block text-sm text-slate-300 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What was done during this service?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Hours at Service
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.hoursAtService || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hoursAtService: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-slate-500 text-xs mt-1">
                This will reset hours since service to 0
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Parts Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.costParts || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costParts: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Labor Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.costLabor || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costLabor: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors"
            >
              Log Service
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

