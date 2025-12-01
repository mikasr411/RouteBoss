"use client";

import { useState, useMemo } from "react";
import { useCustomerStore } from "@/store/customer-store";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";

export default function RoutesPage() {
  const { customers, updateCustomer } = useCustomerStore();
  const [routeName, setRouteName] = useState(
    `Route ${format(new Date(), "MMM d, yyyy")}`
  );
  const [routeDate, setRouteDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const selectedCustomers = useMemo(() => {
    return customers
      .filter((c) => c.isSelectedForRoute)
      .sort((a, b) => {
        // Sort by city, then by display name
        const cityCompare = a.city.localeCompare(b.city);
        if (cityCompare !== 0) return cityCompare;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [customers]);

  const handleExport = () => {
    if (selectedCustomers.length === 0) {
      alert("No customers selected for route. Please select customers from the Customers page.");
      return;
    }

    // Create CSV with Name and ADDRESS columns
    const header = "Name,ADDRESS\n";
    const rows = selectedCustomers.map((customer) => {
      const name = customer.displayName.replace(/"/g, '""'); // Escape quotes
      const address = customer.fullAddress.replace(/"/g, '""'); // Escape quotes
      return `"${name}","${address}"`;
    });

    const csvContent = header + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${routeName.replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearSelection = () => {
    if (
      confirm(
        "Are you sure you want to clear all route selections? This will unselect all customers."
      )
    ) {
      customers.forEach((customer) => {
        if (customer.isSelectedForRoute) {
          updateCustomer(customer.id, { isSelectedForRoute: false });
        }
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-6 text-slate-100">Routes</h1>

        {/* Route Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Route Name</label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Route Date</label>
            <input
              type="date"
              value={routeDate}
              onChange={(e) => setRouteDate(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-700 rounded p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-slate-400 text-sm">Stops</div>
              <div className="text-2xl font-bold text-slate-100">
                {selectedCustomers.length}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">Estimated Revenue</div>
              <div className="text-2xl font-bold text-slate-100">—</div>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={handleExport}
            disabled={selectedCustomers.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded font-semibold transition-colors"
          >
            Export Route for My Maps (CSV)
          </button>
          <button
            onClick={handleClearSelection}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-3 rounded transition-colors"
          >
            Clear Route Selection
          </button>
        </div>

        {/* Tip */}
        <div className="bg-blue-900/20 border border-blue-700 rounded p-4 mb-6">
          <p className="text-blue-200 text-sm">
            💡 <strong>Tip:</strong> Export this CSV and import it as a layer into Google My Maps
            to visualize and drive your route.
          </p>
        </div>

        {/* Selected Customers List */}
        {selectedCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-700">
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Stop #
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Display Name
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    City
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Full Address
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Service Frequency
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Next Service Date
                  </th>
                  <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomers.map((customer, index) => (
                  <tr
                    key={customer.id}
                    className="bg-slate-800 hover:bg-slate-750"
                  >
                    <td className="border border-slate-600 px-4 py-2 text-slate-300 font-semibold">
                      {index + 1}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.displayName}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.city}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                      {customer.fullAddress}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.serviceFrequency}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {formatDate(customer.nextServiceDate)}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                      {customer.notes || customer.addressNotes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-700 rounded p-8 text-center">
            <p className="text-slate-400 mb-4">
              No customers selected for this route.
            </p>
            <p className="text-slate-500 text-sm">
              Go to the <strong>Customers</strong> page to select customers for your route.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

