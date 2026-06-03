"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCustomerStore } from "@/store/customer-store";
import { Customer, ServiceFrequency } from "@/types/customer";
import { formatDate, isCustomerDue, skipServiceCycle, calculateNextServiceDate } from "@/lib/utils";
import { groupDueCustomersByCity } from "@/lib/message-everyone";
import { parse, compareAsc } from "date-fns";
import PhoneContactLinks from "@/components/PhoneContactLinks";

type SortOption = "city" | "lastService" | "nextService";

export default function CustomersPage() {
  const {
    customers,
    manualStops,
    updateCustomer,
    replaceRouteCustomerSelection,
    clearRouteCustomerSelection,
  } = useCustomerStore();
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
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

  const dueByCity = useMemo(
    () => groupDueCustomersByCity(customers),
    [customers]
  );

  const totalDue = useMemo(
    () => dueByCity.reduce((n, g) => n + g.dueCustomers.length, 0),
    [dueByCity]
  );

  const filteredDueCount = useMemo(
    () => filteredCustomers.filter(isCustomerDue).length,
    [filteredCustomers]
  );

  const hasExistingRoute =
    customers.some((c) => c.isSelectedForRoute) || manualStops.length > 0;

  const confirmReplaceRoute = (label: string, count: number) => {
    if (count === 0) return false;
    if (!hasExistingRoute) return true;
    return confirm(
      `Replace your current route with ${count} due customer${count !== 1 ? "s" : ""} ${label}? Extra map stops will be cleared.`
    );
  };

  const showBulkNotice = (message: string) => {
    setBulkNotice(message);
    window.setTimeout(() => setBulkNotice(null), 4000);
  };

  const addDueCityToRoute = (city: string, dueInCity: Customer[]) => {
    const ids = dueInCity.map((c) => c.id);
    if (!confirmReplaceRoute(`in ${city}`, ids.length)) return;
    replaceRouteCustomerSelection(ids);
    showBulkNotice(
      `Added ${ids.length} due customer${ids.length !== 1 ? "s" : ""} in ${city} to the route.`
    );
  };

  const addAllFilteredDueToRoute = () => {
    const dueFiltered = filteredCustomers.filter(isCustomerDue);
    const ids = dueFiltered.map((c) => c.id);
    if (ids.length === 0) return;
    const label =
      selectedCity !== "all"
        ? `in ${selectedCity}`
        : dueOnly
          ? "(all cities)"
          : "matching your filters";
    if (!confirmReplaceRoute(label, ids.length)) return;
    replaceRouteCustomerSelection(ids);
    showBulkNotice(
      `Added ${ids.length} due customer${ids.length !== 1 ? "s" : ""} to the route.`
    );
  };

  const handleClearRoute = () => {
    if (
      !hasExistingRoute ||
      confirm("Clear all customers from the route and remove extra map stops?")
    ) {
      clearRouteCustomerSelection();
      showBulkNotice("Route selection cleared.");
    }
  };

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
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 w-full min-w-0 max-w-full">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6 w-full min-w-0">
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

        {/* Message everyone (by city) */}
        {totalDue > 0 && (
          <div className="mb-6 rounded-lg border border-emerald-800/60 bg-emerald-950/25 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-100">
                  Message everyone (by city)
                </h2>
                <p className="text-sm text-emerald-200/80 mt-1 max-w-2xl">
                  Work one city at a time: add all due customers in that city to
                  your route, then open{" "}
                  <Link href="/routes" className="underline hover:text-emerald-100">
                    Routes
                  </Link>{" "}
                  to copy personalized messages. Clear the route before switching
                  to the next city.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {bulkNotice && (
                  <span className="text-sm text-green-400 sm:self-center">
                    {bulkNotice}
                  </span>
                )}
                <Link
                  href="/routes"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-semibold text-sm text-center transition-colors"
                >
                  Open messenger →
                </Link>
                <button
                  type="button"
                  onClick={handleClearRoute}
                  disabled={!hasExistingRoute}
                  className="border border-slate-500 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm transition-colors"
                >
                  Clear route
                </button>
              </div>
            </div>

            {filteredDueCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 pb-4 border-b border-emerald-900/50">
                <span className="text-sm text-slate-300">
                  Current filters:{" "}
                  <strong className="text-slate-100">{filteredDueCount}</strong>{" "}
                  due
                  {selectedCity !== "all" ? ` in ${selectedCity}` : ""}
                  {dueOnly ? "" : " (turn on Due → Due Only to target only due customers)"}
                </span>
                <button
                  type="button"
                  onClick={addAllFilteredDueToRoute}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-semibold transition-colors sm:ml-auto"
                >
                  Add all due (filtered) to route
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dueByCity.map(({ city, dueCustomers }) => {
                const onRoute = dueCustomers.filter(
                  (c) => c.isSelectedForRoute
                ).length;
                return (
                  <div
                    key={city}
                    className="flex flex-col gap-2 rounded border border-slate-600 bg-slate-800/80 p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100 truncate">
                        {city}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {dueCustomers.length} due
                        {onRoute > 0 ? ` · ${onRoute} on route` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addDueCityToRoute(city, dueCustomers)}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors w-full"
                    >
                      Add all due to route
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="w-full min-w-0 max-w-full overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-700">
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Select
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                  Display Name
                </th>
                <th className="border border-slate-600 px-4 py-2 text-left text-slate-200 whitespace-nowrap">
                  Phone
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
                    <td className="border border-slate-600 px-3 py-2 text-slate-300 text-sm">
                      <PhoneContactLinks
                        mobileNumber={customer.mobileNumber}
                        homeNumber={customer.homeNumber}
                        compact
                      />
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

