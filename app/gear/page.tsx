"use client";

import { useMemo } from "react";
import { useEquipmentStore } from "@/store/equipment-store";
import { getUpcomingServices, getTotalMaintenanceCost, formatCurrency } from "@/lib/equipment-utils";
import { format } from "date-fns";
import Link from "next/link";

export default function GearDashboard() {
  const { equipment, services, reminders } = useEquipmentStore();

  const activeEquipment = useMemo(
    () => equipment.filter((e) => e.status === "active"),
    [equipment]
  );

  const upcomingServices = useMemo(
    () => getUpcomingServices(equipment, reminders, services, 30),
    [equipment, reminders, services]
  );

  const totalMaintenanceThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return services
      .filter((s) => {
        const serviceYear = new Date(s.date).getFullYear();
        return serviceYear === currentYear;
      })
      .reduce((total, service) => {
        return total + (service.costParts || 0) + (service.costLabor || 0);
      }, 0);
  }, [services]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-6 text-slate-100">Gear Garage</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Active Equipment</div>
            <div className="text-2xl font-bold text-slate-100">
              {activeEquipment.length}
            </div>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Upcoming Services</div>
            <div className="text-2xl font-bold text-slate-100">
              {upcomingServices.filter((s) => !s.status.isOverdue).length}
            </div>
            {upcomingServices.filter((s) => s.status.isOverdue).length > 0 && (
              <div className="text-red-400 text-sm mt-1">
                {upcomingServices.filter((s) => s.status.isOverdue).length} overdue
              </div>
            )}
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Maintenance Spend (This Year)</div>
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(totalMaintenanceThisYear)}
            </div>
          </div>
        </div>

        {/* Upcoming Services List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3 text-slate-100">
            Upcoming Services
          </h2>
          {upcomingServices.length > 0 ? (
            <div className="bg-slate-700 rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-600">
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Equipment
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Service
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
                  {upcomingServices.slice(0, 10).map((item) => (
                    <tr
                      key={item.reminder.id}
                      className="bg-slate-800 hover:bg-slate-750"
                    >
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        <Link
                          href={`/gear/equipment/${item.equipment.id}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {item.equipment.name}
                        </Link>
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {item.reminder.name}
                      </td>
                      <td className="border border-slate-600 px-4 py-2">
                        {item.status.isOverdue ? (
                          <span className="text-red-400 font-semibold">
                            Overdue
                          </span>
                        ) : item.status.isDue ? (
                          <span className="text-yellow-400 font-semibold">
                            Due Now
                          </span>
                        ) : (
                          <span className="text-green-400">Upcoming</span>
                        )}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {item.status.daysUntilDue !== undefined ? (
                          item.status.isOverdue ? (
                            <span className="text-red-400">
                              {Math.abs(item.status.daysUntilDue)} days ago
                            </span>
                          ) : (
                            `${item.status.daysUntilDue} days`
                          )
                        ) : item.status.hoursUntilDue !== undefined ? (
                          item.status.isOverdue ? (
                            <span className="text-red-400">
                              {Math.abs(Math.round(item.status.hoursUntilDue))} hours overdue
                            </span>
                          ) : (
                            `~${Math.round(item.status.hoursUntilDue)} hours`
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-700 rounded p-8 text-center">
              <p className="text-slate-400">
                No upcoming services. All caught up! 🎉
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4">
          <Link
            href="/gear/equipment"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold transition-colors"
          >
            View All Equipment
          </Link>
          <Link
            href="/gear/equipment/new"
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-3 rounded transition-colors"
          >
            Add Equipment
          </Link>
        </div>
      </div>
    </div>
  );
}

