"use client";

import { useState, useMemo, useEffect } from "react";
import { useCustomerStore } from "@/store/customer-store";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";
import {
  DEFAULT_TEMPLATE,
  buildTemplateVariables,
  applyTemplate,
} from "@/lib/message-template";
import PhoneContactLinks from "@/components/PhoneContactLinks";
import { useRouteHistoryStore } from "@/store/route-history-store";
import type { SavedRoute } from "@/types/saved-route";
import type { Customer } from "@/types/customer";
import type { ManualRouteStop } from "@/types/manual-stop";
import { routeVisitLetter } from "@/lib/route-visit-letter";

export default function RoutesPage() {
  const {
    customers,
    updateCustomer,
    manualStops,
    clearManualStops,
    removeManualStop,
    setManualStops,
    routeStopOrder,
  } = useCustomerStore();
  const { savedRoutes, saveRoute, removeSavedRoute } = useRouteHistoryStore();
  const [routeName, setRouteName] = useState(
    `Route ${format(new Date(), "MMM d, yyyy")}`
  );
  const [routeDate, setRouteDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  // Load template from localStorage or use default
  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("routeboss:messageTemplate");
    if (saved) {
      setTemplate(saved);
    }
  }, []);

  // Save template to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("routeboss:messageTemplate", template);
  }, [template]);

  const selectedCustomers = useMemo(() => {
    return customers.filter((c) => c.isSelectedForRoute);
  }, [customers]);

  const totalRouteStops = selectedCustomers.length + manualStops.length;

  /** Same visit order as Map “On this route” (routeStopOrder), with fallbacks. */
  type VisitStopRow =
    | { kind: "customer"; letter: string; customer: Customer }
    | { kind: "manual"; letter: string; stop: ManualRouteStop };

  const visitStopsInOrder = useMemo((): VisitStopRow[] => {
    const rows: VisitStopRow[] = [];
    let idx = 0;
    const seenCustomer = new Set<string>();
    const seenManual = new Set<string>();

    if (routeStopOrder.length > 0) {
      for (const key of routeStopOrder) {
        if (key.kind === "customer") {
          const c = customers.find(
            (x) => x.id === key.id && x.isSelectedForRoute
          );
          if (c) {
            rows.push({
              kind: "customer",
              letter: routeVisitLetter(idx++),
              customer: c,
            });
            seenCustomer.add(c.id);
          }
        } else {
          const s = manualStops.find((x) => x.id === key.id);
          if (s) {
            rows.push({
              kind: "manual",
              letter: routeVisitLetter(idx++),
              stop: s,
            });
            seenManual.add(s.id);
          }
        }
      }
    }

    for (const c of customers) {
      if (!c.isSelectedForRoute || seenCustomer.has(c.id)) continue;
      rows.push({
        kind: "customer",
        letter: routeVisitLetter(idx++),
        customer: c,
      });
      seenCustomer.add(c.id);
    }
    for (const s of manualStops) {
      if (seenManual.has(s.id)) continue;
      rows.push({
        kind: "manual",
        letter: routeVisitLetter(idx++),
        stop: s,
      });
      seenManual.add(s.id);
    }

    if (rows.length === 0 && totalRouteStops > 0) {
      const sorted = customers
        .filter((c) => c.isSelectedForRoute)
        .sort((a, b) => {
          const cityCompare = a.city.localeCompare(b.city);
          if (cityCompare !== 0) return cityCompare;
          return a.displayName.localeCompare(b.displayName);
        });
      idx = 0;
      for (const c of sorted) {
        rows.push({
          kind: "customer",
          letter: routeVisitLetter(idx++),
          customer: c,
        });
      }
      for (const s of manualStops) {
        rows.push({
          kind: "manual",
          letter: routeVisitLetter(idx++),
          stop: s,
        });
      }
    }

    return rows;
  }, [customers, manualStops, routeStopOrder, totalRouteStops]);

  const customersInVisitOrder = useMemo(
    () =>
      visitStopsInOrder
        .filter((r) => r.kind === "customer")
        .map((r) => r.customer),
    [visitStopsInOrder]
  );

  const handleExport = () => {
    if (totalRouteStops === 0) {
      alert(
        "No stops on your route. Select customers or add an address from the Map page."
      );
      return;
    }

    // Create CSV with Name and ADDRESS columns (customers + extra stops)
    const header = "Name,ADDRESS\n";
    const snap = useCustomerStore.getState();
    const startRows = snap.routeStart
      ? [
          `"${snap.routeStart.label.replace(/"/g, '""')}","${snap.routeStart.address.replace(/"/g, '""')}"`,
        ]
      : [];

    const rowForCustomer = (customer: (typeof selectedCustomers)[0]) => {
      const name = customer.displayName.replace(/"/g, '""');
      const address = customer.fullAddress.replace(/"/g, '""');
      return `"${name}","${address}"`;
    };
    const rowForManual = (stop: (typeof manualStops)[0]) => {
      const name = stop.label.replace(/"/g, '""');
      const address = stop.address.replace(/"/g, '""');
      return `"${name}","${address}"`;
    };

    let bodyRows: string[];
    if (snap.routeStopOrder.length > 0) {
      bodyRows = [];
      for (const key of snap.routeStopOrder) {
        if (key.kind === "customer") {
          const c = selectedCustomers.find((x) => x.id === key.id);
          if (c) bodyRows.push(rowForCustomer(c));
        } else {
          const s = manualStops.find((x) => x.id === key.id);
          if (s) bodyRows.push(rowForManual(s));
        }
      }
    } else {
      bodyRows = [
        ...selectedCustomers.map(rowForCustomer),
        ...manualStops.map(rowForManual),
      ];
    }

    const rows = [...startRows, ...bodyRows];

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
        "Clear all route selections? This unselects all customers and removes extra stops from the map."
      )
    ) {
      customers.forEach((customer) => {
        if (customer.isSelectedForRoute) {
          updateCustomer(customer.id, { isSelectedForRoute: false });
        }
      });
      clearManualStops();
    }
  };

  /** Same flag as Map checkboxes — Map and Routes stay in sync via the store. */
  const removeCustomerFromRoute = (customerId: string) => {
    updateCustomer(customerId, { isSelectedForRoute: false });
  };

  const handleSaveRouteToHistory = () => {
    if (totalRouteStops === 0) return;
    const snap = useCustomerStore.getState();
    saveRoute({
      name: routeName,
      routeDate,
      customerIds: customersInVisitOrder.map((c) => c.id),
      manualStops,
      routeStopOrder: snap.routeStopOrder,
      routeStart: snap.routeStart,
    });
    setHistoryNotice("Route saved to history.");
    window.setTimeout(() => setHistoryNotice(null), 3500);
  };

  const applySavedRoute = (route: SavedRoute) => {
    const state = useCustomerStore.getState();
    const {
      customers: all,
      updateCustomer: patch,
      setManualStops: setManual,
      setRouteStopOrder,
      setRouteStart,
      clearRouteStart,
    } = state;
    const hasCurrent =
      all.some((c) => c.isSelectedForRoute) || state.manualStops.length > 0;
    if (
      hasCurrent &&
      !confirm(
        "Replace your current route with this saved one? Your current selections and extra stops will be cleared first."
      )
    ) {
      return;
    }
    all.forEach((c) => {
      if (c.isSelectedForRoute) patch(c.id, { isSelectedForRoute: false });
    });
    route.customerIds.forEach((id) => {
      if (all.some((c) => c.id === id)) {
        patch(id, { isSelectedForRoute: true });
      }
    });
    setManual(route.manualStops.map((s) => ({ ...s })));

    const customerIdSet = new Set(route.customerIds);
    const manualIdSet = new Set(route.manualStops.map((s) => s.id));
    let order =
      route.routeStopOrder?.filter((k) =>
        k.kind === "customer"
          ? customerIdSet.has(k.id)
          : manualIdSet.has(k.id)
      ) ?? [];
    const inOrder = new Set(order.map((k) => `${k.kind}:${k.id}`));
    for (const id of route.customerIds) {
      if (all.some((c) => c.id === id) && !inOrder.has(`customer:${id}`)) {
        order.push({ kind: "customer", id });
        inOrder.add(`customer:${id}`);
      }
    }
    for (const s of route.manualStops) {
      if (!inOrder.has(`manual:${s.id}`)) {
        order.push({ kind: "manual", id: s.id });
        inOrder.add(`manual:${s.id}`);
      }
    }
    setRouteStopOrder(order);

    if (route.routeStart !== undefined) {
      if (route.routeStart) setRouteStart({ ...route.routeStart });
      else clearRouteStart();
    }

    setRouteName(route.name);
    setRouteDate(route.routeDate);
    setHistoryNotice(`Loaded “${route.name}”.`);
    window.setTimeout(() => setHistoryNotice(null), 3500);
  };

  const handleDeleteSavedRoute = (id: string, label: string) => {
    if (confirm(`Remove “${label}” from saved history?`)) {
      removeSavedRoute(id);
    }
  };

  // Generate messages in map visit order (customers only; skips extra stops)
  const generatedMessages = useMemo(() => {
    return visitStopsInOrder
      .filter((r) => r.kind === "customer")
      .map((r) => {
        const variables = buildTemplateVariables(r.customer);
        const message = applyTemplate(template, variables);
        return { customer: r.customer, letter: r.letter, message };
      });
  }, [visitStopsInOrder, template]);

  // Copy single message
  const handleCopyMessage = async (message: string, customerName: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopySuccess(`Copied message for ${customerName}`);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      alert("Failed to copy message");
    }
  };

  // Copy all messages
  const handleCopyAll = async () => {
    if (generatedMessages.length === 0) return;

    const allMessages = generatedMessages
      .map((item) => {
        return `${item.letter} — ${item.customer.displayName} (${item.customer.city}, ${item.customer.state})\n\n${item.message}`;
      })
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(allMessages);
      setCopySuccess("Copied all messages to clipboard!");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      alert("Failed to copy messages");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 w-full min-w-0 max-w-full">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6 w-full min-w-0">
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

        {/* Save & route history */}
        <div className="bg-slate-700/90 rounded-lg border border-slate-600 p-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Save & route history
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Save a snapshot of the stops below (customers + extra stops). Load a
            saved route anytime to restore those selections on the Map and here.
            Customers who were deleted since saving are skipped.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center mb-4">
            <button
              type="button"
              onClick={handleSaveRouteToHistory}
              disabled={totalRouteStops === 0}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-semibold text-sm transition-colors w-full sm:w-auto"
            >
              Save current route to history
            </button>
            {historyNotice && (
              <span className="text-sm text-green-400">{historyNotice}</span>
            )}
          </div>
          {savedRoutes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved routes yet. Build a route and click save.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[min(50vh,320px)] overflow-y-auto pr-1">
              {savedRoutes.map((r) => {
                const n = r.customerIds.length + r.manualStops.length;
                const missing =
                  r.customerIds.filter((id) => !customers.some((c) => c.id === id))
                    .length;
                return (
                  <li
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-slate-600 bg-slate-800/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100 truncate">
                        {r.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Route date {r.routeDate} · Saved{" "}
                        {format(new Date(r.savedAt), "MMM d, yyyy h:mm a")} ·{" "}
                        {n} stop{n !== 1 ? "s" : ""}
                        {missing > 0 ? (
                          <span className="text-amber-400/90">
                            {" "}
                            ({missing} contact{missing !== 1 ? "s" : ""} no longer
                            in list)
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => applySavedRoute(r)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        Use this route
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedRoute(r.id, r.name)}
                        className="border border-slate-500 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Summary */}
        <div className="bg-slate-700 rounded p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-slate-400 text-sm">Stops</div>
              <div className="text-2xl font-bold text-slate-100">
                {totalRouteStops}
              </div>
              {manualStops.length > 0 && (
                <div className="text-slate-500 text-xs mt-1">
                  {selectedCustomers.length} customers + {manualStops.length}{" "}
                  extra
                </div>
              )}
            </div>
            <div>
              <div className="text-slate-400 text-sm">Estimated Revenue</div>
              <div className="text-2xl font-bold text-slate-100">—</div>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleExport}
            disabled={totalRouteStops === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded font-semibold transition-colors w-full sm:w-auto"
          >
            Export Route for My Maps (CSV)
          </button>
          <button
            onClick={handleClearSelection}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-3 rounded transition-colors w-full sm:w-auto"
          >
            Clear Route Selection
          </button>
        </div>

        {/* Tip */}
        <div className="bg-blue-900/20 border border-blue-700 rounded p-4 mb-6">
          <p className="text-blue-200 text-sm">
            💡 <strong>Tip:</strong> Export this CSV and import it as a layer into Google My Maps
            to visualize and drive your route. Or use the{" "}
            <a href="/map" className="underline hover:text-blue-100">
              Map View
            </a>{" "}
            to visualize and optimize your route.
          </p>
          <p className="text-blue-200/90 text-sm mt-2">
            Removing someone here (e.g. they said no) updates the{" "}
            <a href="/map" className="underline hover:text-blue-100">
              Map
            </a>{" "}
            automatically — it uses the same route selection.
          </p>
        </div>

        {/* Selected Customers List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3 text-slate-100">
            Selected Stops
          </h2>
          {totalRouteStops > 0 ? (
            <>
              {/* Compact cards on small screens */}
              <div className="md:hidden space-y-3 mb-4">
                {visitStopsInOrder.map((row) =>
                  row.kind === "customer" ? (
                    <div
                      key={`customer:${row.customer.id}`}
                      className="rounded-lg border border-slate-600 bg-slate-800 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-amber-300 ring-1 ring-amber-600/50">
                            {row.letter}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-100 block">
                              {row.customer.displayName}
                            </span>
                          </div>
                        </div>
                        <PhoneContactLinks
                          mobileNumber={row.customer.mobileNumber}
                          homeNumber={row.customer.homeNumber}
                          compact
                          showEmpty={false}
                        />
                      </div>
                      <p className="text-sm text-slate-300 leading-snug">
                        {row.customer.fullAddress}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>
                          {row.customer.city}, {row.customer.state}
                        </span>
                        <span>{row.customer.serviceFrequency}</span>
                        <span>
                          Next: {formatDate(row.customer.nextServiceDate)}
                        </span>
                      </div>
                      {(row.customer.notes || row.customer.addressNotes) && (
                        <p className="text-xs text-slate-500 border-t border-slate-600 pt-2">
                          {row.customer.notes || row.customer.addressNotes}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          removeCustomerFromRoute(row.customer.id)
                        }
                        className="w-full mt-1 text-sm font-medium rounded border border-red-800/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 px-3 py-2 transition-colors"
                      >
                        Remove from route
                      </button>
                    </div>
                  ) : (
                    <div
                      key={`manual:${row.stop.id}`}
                      className="rounded-lg border border-purple-800/60 bg-purple-950/25 p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2 font-semibold text-purple-200">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-amber-300 ring-1 ring-amber-600/50">
                          {row.letter}
                        </span>
                        <span>
                          {row.stop.label}{" "}
                          <span className="text-slate-500 text-xs font-normal">
                            (extra)
                          </span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{row.stop.address}</p>
                      <button
                        type="button"
                        onClick={() => removeManualStop(row.stop.id)}
                        className="w-full mt-2 text-sm font-medium rounded border border-red-800/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 px-3 py-2 transition-colors"
                      >
                        Remove extra stop
                      </button>
                    </div>
                  )
                )}
              </div>

              <div className="hidden md:block w-full max-w-full min-w-0 overflow-x-auto">
              <table className="w-full border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-slate-700">
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Stop
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Display Name
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Mobile / Phone
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
                    <th className="border border-slate-600 px-3 py-2 text-left text-slate-200 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visitStopsInOrder.map((row) =>
                    row.kind === "customer" ? (
                      <tr
                        key={`customer:${row.customer.id}`}
                        className="bg-slate-800 hover:bg-slate-750"
                      >
                        <td className="border border-slate-600 px-4 py-2 text-slate-300 font-bold text-amber-300 tabular-nums">
                          {row.letter}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {row.customer.displayName}
                        </td>
                        <td className="border border-slate-600 px-3 py-2 text-slate-300 text-sm">
                          <PhoneContactLinks
                            mobileNumber={row.customer.mobileNumber}
                            homeNumber={row.customer.homeNumber}
                            compact
                          />
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {row.customer.city}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                          {row.customer.fullAddress}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {row.customer.serviceFrequency}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300">
                          {formatDate(row.customer.nextServiceDate)}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                          {row.customer.notes || row.customer.addressNotes || "—"}
                        </td>
                        <td className="border border-slate-600 px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              removeCustomerFromRoute(row.customer.id)
                            }
                            className="text-xs font-medium rounded border border-red-800/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 px-2 py-1.5 transition-colors whitespace-nowrap"
                            title="Remove from route (e.g. customer declined)"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={`manual:${row.stop.id}`}
                        className="bg-purple-950/30 hover:bg-purple-950/40"
                      >
                        <td className="border border-slate-600 px-4 py-2 text-slate-300 font-bold text-amber-300 tabular-nums">
                          {row.letter}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-purple-200">
                          {row.stop.label}{" "}
                          <span className="text-slate-500 text-xs">(extra)</span>
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-500">
                          —
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-500">
                          —
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                          {row.stop.address}
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-500">
                          —
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-500">
                          —
                        </td>
                        <td className="border border-slate-600 px-4 py-2 text-slate-500 text-sm">
                          Map lookup
                        </td>
                        <td className="border border-slate-600 px-2 py-2">
                          <button
                            type="button"
                            onClick={() => removeManualStop(row.stop.id)}
                            className="text-xs font-medium rounded border border-red-800/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 px-2 py-1.5 transition-colors whitespace-nowrap"
                            title="Remove this extra stop from the route"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <div className="bg-slate-700 rounded p-8 text-center">
              <p className="text-slate-400 mb-4">
                No stops on this route yet.
              </p>
              <p className="text-slate-500 text-sm">
                Select customers on the <strong>Customers</strong> page, or add
                an address from the <strong>Map</strong> page.
              </p>
            </div>
          )}
        </div>

        {/* Message Template Builder */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3 text-slate-100">
            Message Template Builder
          </h2>

          <div className="bg-slate-700 rounded p-4 mb-4">
            <label className="block text-sm text-slate-300 mb-2">
              Message Template
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Use placeholders like{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{displayName}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{fullAddress}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{daysSinceLastService}"}
              </code>
              . One message will be generated per selected stop.
            </p>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Enter your message template..."
            />
            <div className="mt-2 text-xs text-slate-400">
              Available variables:{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{displayName}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{fullAddress}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{city}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{state}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{mobileNumber}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{lastServiceDate}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{nextServiceDate}"}
              </code>
              ,{" "}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">
                {"{daysSinceLastService}"}
              </code>
            </div>
          </div>

          {/* Generated Messages */}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-100">
                Generated Messages
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {copySuccess && (
                  <div className="text-green-400 text-sm sm:order-none">
                    {copySuccess}
                  </div>
                )}
                <button
                  onClick={handleCopyAll}
                  disabled={generatedMessages.length === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-semibold transition-colors w-full sm:w-auto"
                >
                  Copy All Messages
                </button>
              </div>
            </div>

            {generatedMessages.length === 0 ? (
              <div className="bg-slate-700 rounded p-8 text-center">
                <p className="text-slate-400">
                  Select at least one stop in your route to generate messages.
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto space-y-4">
                {generatedMessages.map((item) => (
                  <div
                    key={item.customer.id}
                    className="bg-slate-700 rounded p-4 border border-slate-600"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-amber-300 ring-1 ring-amber-600/50">
                            {item.letter}
                          </span>
                          <span>
                            {item.customer.displayName} (
                            {item.customer.city}, {item.customer.state})
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 break-words">
                          {item.customer.fullAddress}
                        </p>
                        <PhoneContactLinks
                          mobileNumber={item.customer.mobileNumber}
                          homeNumber={item.customer.homeNumber}
                        />
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0 self-stretch sm:self-start">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyMessage(item.message, item.customer.displayName)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors w-full sm:w-auto"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeCustomerFromRoute(item.customer.id)
                          }
                          className="text-xs font-medium rounded border border-red-800/60 bg-red-950/40 text-red-200 hover:bg-red-950/70 px-3 py-1.5 transition-colors w-full sm:w-auto"
                          title="Remove from route if they declined"
                        >
                          Remove from route
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-3 border border-slate-600">
                      <pre className="text-slate-100 text-sm whitespace-pre-wrap font-sans">
                        {item.message}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

