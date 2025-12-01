"use client";

import { useState, useMemo } from "react";
import { useCustomerStore } from "@/store/customer-store";
import { Customer, ServiceFrequency } from "@/types/customer";
import { formatDate, isCustomerDue, skipServiceCycle, calculateNextServiceDate } from "@/lib/utils";
import { parse, compareAsc } from "date-fns";

type SortOption = "city" | "lastService" | "nextService";

export default function CustomersPage() {
  const { customers, updateCustomer } = useCustomerStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("city");

  // Get unique cities
  const cities = useMemo(() => {
    const citySet = new Set(customers.map((c) => c.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [customers]);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Search by name
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) =>
        c.displayName.toLowerCase().includes(query)
      );
    }

    // City filter
    if (selectedCity !== "all") {
      filtered = filtered.filter((c) => c.city === selectedCity);
    }

    // Frequency filter
    if (selectedFrequency !== "all") {
      filtered = filtered.filter((c) => c.serviceFrequency === selectedFrequency);
    }

    // Due filter
    if (dueOnly) {
      filtered = filtered.filter(isCustomerDue);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "city":
          const cityCompare = a.city.localeCompare(b.city);
          if (cityCompare !== 0) return cityCompare;
          return a.displayName.localeCompare(b.displayName);
        case "lastService":
          if (!a.lastServiceDate && !b.lastServiceDate) return 0;
          if (!a.lastServiceDate) return 1;
          if (!b.lastServiceDate) return -1;
          try {
            const dateA = parse(a.lastServiceDate, "yyyy-MM-dd", new Date());
            const dateB = parse(b.lastServiceDate, "yyyy-MM-dd", new Date());
            return compareAsc(dateA, dateB);
          } catch {
            return 0;
          }
        case "nextService":
          if (!a.nextServiceDate && !b.nextServiceDate) return 0;
          if (!a.nextServiceDate) return 1;
          if (!b.nextServiceDate) return -1;
          try {
            const dateA = parse(a.nextServiceDate, "yyyy-MM-dd", new Date());
            const dateB = parse(b.nextServiceDate, "yyyy-MM-dd", new Date());
            return compareAsc(dateA, dateB);
          } catch {
            return 0;
          }
        default:
          return 0;
      }
    });

    return filtered;
  }, [customers, searchQuery, selectedCity, selectedFrequency, dueOnly, sortBy]);

  const selectedCount = customers.filter((c) => c.isSelectedForRoute).length;

  const handleFrequencyChange = (customerId: string, newFrequency: ServiceFrequency) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const newNextServiceDate = calculateNextServiceDate(
      customer.lastServiceDate,
      newFrequency
    );

    updateCustomer(customerId, {
      serviceFrequency: newFrequency,
      nextServiceDate: newNextServiceDate,
    });
  };

  const handleSkip = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const updated = skipServiceCycle(customer);
    updateCustomer(customerId, {
      nextServiceDate: updated.nextServiceDate,
    });
  };

  const handleToggleSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    updateCustomer(customerId, {
      isSelectedForRoute: !customer.isSelectedForRoute,
    });
  };

  const openGoogleMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-6 text-slate-100">Customers</h1>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Total customers</div>
            <div className="text-2xl font-bold text-slate-100">{customers.length}</div>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Filtered customers</div>
            <div className="text-2xl font-bold text-slate-100">{filteredCustomers.length}</div>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-slate-400 text-sm">Selected for route</div>
            <div className="text-2xl font-bold text-slate-100">{selectedCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Search by name</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Frequency</label>
            <select
              value={selectedFrequency}
              onChange={(e) => setSelectedFrequency(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="Biannual">Biannual</option>
              <option value="Quarterly">Quarterly</option>
              <option value="OneTime">OneTime</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Due</label>
            <select
              value={dueOnly ? "due" : "all"}
              onChange={(e) => setDueOnly(e.target.value === "due")}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="due">Due Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="city">City (A–Z)</option>
              <option value="lastService">Last Service (oldest first)</option>
              <option value="nextService">Next Service (oldest first)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-700">
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Select
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Display Name
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  City
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  State
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Last Service
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Next Service
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Frequency
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const due = isCustomerDue(customer);
                return (
                  <tr
                    key={customer.id}
                    className={`bg-slate-800 hover:bg-slate-750 ${
                      due ? "bg-red-900/20" : ""
                    }`}
                  >
                    <td className="border border-slate-600 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={customer.isSelectedForRoute || false}
                        onChange={() => handleToggleSelect(customer.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.displayName}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.city}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {customer.state}
                    </td>
                    <td className="border border-slate-600 px-4 py-2 text-slate-300">
                      {formatDate(customer.lastServiceDate)}
                    </td>
                    <td
                      className={`border border-slate-600 px-4 py-2 ${
                        due ? "text-red-400 font-semibold" : "text-slate-300"
                      }`}
                    >
                      {formatDate(customer.nextServiceDate)}
                    </td>
                    <td className="border border-slate-600 px-4 py-2">
                      <select
                        value={customer.serviceFrequency}
                        onChange={(e) =>
                          handleFrequencyChange(
                            customer.id,
                            e.target.value as ServiceFrequency
                          )
                        }
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Quarterly">Quarterly</option>
                        <option value="Biannual">Biannual</option>
                        <option value="OneTime">OneTime</option>
                      </select>
                    </td>
                    <td className="border border-slate-600 px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSkip(customer.id)}
                          className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1 rounded text-sm transition-colors"
                          title="Skip this service cycle"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => openGoogleMaps(customer.fullAddress)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                          title="View on Google Maps"
                        >
                          Maps
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No customers found matching your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

