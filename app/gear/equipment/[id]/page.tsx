"use client";

import { useParams, useRouter } from "next/navigation";
import { useEquipmentStore } from "@/store/equipment-store";
import {
  getTotalMaintenanceCost,
  getCostPerHour,
  formatCurrency,
  formatDate,
  formatEquipmentType,
} from "@/lib/equipment-utils";
import { getReminderStatus } from "@/lib/reminders";
import { useState } from "react";
import Link from "next/link";

export default function EquipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = params.id as string;

  const { equipment, services, reminders, deleteEquipment } =
    useEquipmentStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const equipmentServices = services.filter((s) => s.equipmentId === equipmentId);
  const equipmentReminders = reminders.filter((r) => r.equipmentId === equipmentId);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <p className="text-slate-400">Equipment not found.</p>
          <Link
            href="/gear/equipment"
            className="text-blue-400 hover:text-blue-300 underline mt-4 inline-block"
          >
            ← Back to Equipment
          </Link>
        </div>
      </div>
    );
  }

  const totalCost = getTotalMaintenanceCost(item, services);
  const costPerHour = getCostPerHour(item, services);

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this equipment? This will also delete all associated service records and reminders.")) {
      deleteEquipment(equipmentId);
      router.push("/gear/equipment");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/gear/equipment"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
            >
              ← Back to Equipment
            </Link>
            <h1 className="text-3xl font-bold text-slate-100">{item.name}</h1>
            <p className="text-slate-400 mt-1">
              {formatEquipmentType(item.type)} •{" "}
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/gear/equipment/${equipmentId}/edit`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Quick Info Card */}
        <div className="bg-slate-700 rounded p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-slate-400 text-sm">Total Hours</div>
              <div className="text-2xl font-bold text-slate-100">
                {item.hoursTotal?.toLocaleString() || "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">Hours Since Service</div>
              <div className="text-2xl font-bold text-slate-100">
                {item.hoursSinceService?.toLocaleString() || "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">Cost Per Hour</div>
              <div className="text-2xl font-bold text-slate-100">
                {costPerHour ? formatCurrency(costPerHour) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => router.push(`/gear/equipment/${equipmentId}/add-hours`)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold transition-colors"
          >
            Add Hours
          </button>
          <button
            onClick={() => router.push(`/gear/equipment/${equipmentId}/log-service`)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors"
          >
            Log Service
          </button>
          <button
            onClick={() => router.push(`/gear/equipment/${equipmentId}/add-reminder`)}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-2 rounded font-semibold transition-colors"
          >
            Add Reminder
          </button>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-2 text-slate-100">Details</h2>
            <div className="bg-slate-700 rounded p-4 space-y-2">
              {item.serialNumber && (
                <div>
                  <span className="text-slate-400">Serial Number: </span>
                  <span className="text-slate-200">{item.serialNumber}</span>
                </div>
              )}
              {item.purchaseDate && (
                <div>
                  <span className="text-slate-400">Purchase Date: </span>
                  <span className="text-slate-200">{formatDate(item.purchaseDate)}</span>
                </div>
              )}
              {item.purchasePrice && (
                <div>
                  <span className="text-slate-400">Purchase Price: </span>
                  <span className="text-slate-200">{formatCurrency(item.purchasePrice)}</span>
                </div>
              )}
              {item.inServiceDate && (
                <div>
                  <span className="text-slate-400">In Service Date: </span>
                  <span className="text-slate-200">{formatDate(item.inServiceDate)}</span>
                </div>
              )}
              {item.notes && (
                <div>
                  <span className="text-slate-400">Notes: </span>
                  <span className="text-slate-200">{item.notes}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2 text-slate-100">Cost Summary</h2>
            <div className="bg-slate-700 rounded p-4 space-y-2">
              <div>
                <span className="text-slate-400">Total Maintenance Cost: </span>
                <span className="text-slate-200 font-semibold">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Service Records: </span>
                <span className="text-slate-200">{equipmentServices.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders */}
        {equipmentReminders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 text-slate-100">Reminders</h2>
            <div className="bg-slate-700 rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-600">
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Name
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Status
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentReminders.map((reminder) => {
                    const status = getReminderStatus(reminder, item);
                    return (
                      <tr key={reminder.id} className="bg-slate-800">
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {reminder.name}
                        </td>
                        <td className="border border-slate-600 px-4 py-2">
                          {status.isOverdue ? (
                            <span className="text-red-400 font-semibold">Overdue</span>
                          ) : status.isDue ? (
                            <span className="text-yellow-400 font-semibold">Due Now</span>
                          ) : (
                            <span className="text-green-400">Upcoming</span>
                          )}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {status.daysUntilDue !== undefined
                            ? `${status.daysUntilDue} days`
                            : status.hoursUntilDue !== undefined
                            ? `~${Math.round(status.hoursUntilDue)} hours`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Service History */}
        <div>
          <h2 className="text-lg font-semibold mb-2 text-slate-100">Service History</h2>
          {equipmentServices.length > 0 ? (
            <div className="bg-slate-700 rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-600">
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Date
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Type
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Description
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Hours
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentServices
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((service) => (
                      <tr key={service.id} className="bg-slate-800">
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {formatDate(service.date)}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {service.serviceType
                            .split("_")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {service.description}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {service.hoursAtService?.toLocaleString() || "—"}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {formatCurrency(
                            (service.costParts || 0) + (service.costLabor || 0)
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-700 rounded p-8 text-center">
              <p className="text-slate-400 mb-4">No service records yet.</p>
              <button
                onClick={() => router.push(`/gear/equipment/${equipmentId}/log-service`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
              >
                Log First Service
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

