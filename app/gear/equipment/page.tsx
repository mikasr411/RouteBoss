"use client";

import { useState, useMemo } from "react";
import { useEquipmentStore } from "@/store/equipment-store";
import {
  formatEquipmentType,
  formatDate,
  getLastServiceDate,
} from "@/lib/equipment-utils";
import { EquipmentType, EquipmentStatus } from "@/types/equipment";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EquipmentListPage() {
  const { equipment, services } = useEquipmentStore();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredEquipment = useMemo(() => {
    let filtered = equipment;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.serialNumber?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((e) => e.type === selectedType);
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((e) => e.status === selectedStatus);
    }

    // Sort by name
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [equipment, searchQuery, selectedType, selectedStatus]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-100">Equipment</h1>
          <button
            onClick={() => router.push("/gear/equipment/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors"
          >
            Add Equipment
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or serial..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {equipmentTypes.map((type) => (
                <option key={type} value={type}>
                  {formatEquipmentType(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-700">
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Name
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Type
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Status
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Hours Total
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Last Serviced
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map((item) => {
                const lastService = getLastServiceDate(item, services);
                return (
                  <tr
                    key={item.id}
                    className="bg-slate-800 hover:bg-slate-750 cursor-pointer"
                    onClick={() => router.push(`/gear/equipment/${item.id}`)}
                  >
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      <Link
                        href={`/gear/equipment/${item.id}`}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {formatEquipmentType(item.type)}
                    </td>
                    <td className="border border-slate-600 px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          item.status === "active"
                            ? "bg-green-900 text-green-200"
                            : item.status === "spare"
                            ? "bg-blue-900 text-blue-200"
                            : item.status === "retired"
                            ? "bg-slate-600 text-slate-200"
                            : "bg-red-900 text-red-200"
                        }`}
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {item.hoursTotal?.toLocaleString() || "—"}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {formatDate(lastService)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredEquipment.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No equipment found.{" "}
              <button
                onClick={() => router.push("/gear/equipment/new")}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Add your first piece of equipment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

