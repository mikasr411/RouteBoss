"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  format,
  parse,
  startOfWeek,
  addDays,
  addWeeks,
  isToday,
} from "date-fns";
import { useRouteHistoryStore } from "@/store/route-history-store";
import { useCustomerStore } from "@/store/customer-store";
import { routeVisitLetter } from "@/lib/route-visit-letter";
import type { SavedRoute } from "@/types/saved-route";
import type { RouteStopKey } from "@/types/route-plan";

/**
 * Visit order for a saved route: stored order filtered to stops that still
 * exist on the route, with any unlisted stops appended (same rules as
 * loading the route).
 */
function normalizedStopOrder(route: SavedRoute): RouteStopKey[] {
  const customerIdSet = new Set(route.customerIds);
  const manualIdSet = new Set(route.manualStops.map((s) => s.id));
  const order: RouteStopKey[] =
    route.routeStopOrder?.filter((k) =>
      k.kind === "customer" ? customerIdSet.has(k.id) : manualIdSet.has(k.id)
    ) ?? [];
  const seen = new Set(order.map((k) => `${k.kind}:${k.id}`));
  for (const id of route.customerIds) {
    if (!seen.has(`customer:${id}`)) {
      order.push({ kind: "customer", id });
      seen.add(`customer:${id}`);
    }
  }
  for (const s of route.manualStops) {
    if (!seen.has(`manual:${s.id}`)) {
      order.push({ kind: "manual", id: s.id });
      seen.add(`manual:${s.id}`);
    }
  }
  return order;
}

type DayWindow = {
  dateKey: string;
  /** Pixel offset from top-left of the planner (or viewport when fixed) */
  x: number;
  y: number;
  z: number;
};

type Props = {
  /** Called after the user picks a route to load (e.g. apply + navigate) */
  onUseRoute: (route: SavedRoute) => void;
};

/**
 * Week planner: days listed vertically, saved routes shown on their route
 * date. Pop out any day into its own floating window so you can edit several
 * days side by side. Routes can also be dragged onto another day.
 */
export default function WeekRoutePlanner({ onUseRoute }: Props) {
  const {
    savedRoutes,
    removeSavedRoute,
    updateSavedRouteDate,
    updateSavedRouteStopOrder,
  } = useRouteHistoryStore();
  const customers = useCustomerStore((s) => s.customers);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [dragRouteId, setDragRouteId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  /** Days whose route list is expanded in the week list; today starts open */
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set([format(new Date(), "yyyy-MM-dd")])
  );
  /** Routes whose stop list is expanded */
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(
    () => new Set()
  );
  /** Floating day windows — multiple can be open at once */
  const [dayWindows, setDayWindows] = useState<DayWindow[]>([]);
  const zCounter = useRef(10);
  const dragWindowRef = useRef<{
    dateKey: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const toggleRouteStops = (routeId: string) => {
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const openDayWindow = (dateKey: string) => {
    setDayWindows((prev) => {
      const existing = prev.find((w) => w.dateKey === dateKey);
      if (existing) {
        zCounter.current += 1;
        return prev.map((w) =>
          w.dateKey === dateKey ? { ...w, z: zCounter.current } : w
        );
      }
      zCounter.current += 1;
      const offset = prev.length * 28;
      return [
        ...prev,
        {
          dateKey,
          x: 16 + offset,
          y: 72 + offset,
          z: zCounter.current,
        },
      ];
    });
    // Also expand that day's accordion so the list stays in sync
    setExpandedDays((prev) => new Set(prev).add(dateKey));
  };

  const closeDayWindow = (dateKey: string) => {
    setDayWindows((prev) => prev.filter((w) => w.dateKey !== dateKey));
  };

  const bringWindowToFront = (dateKey: string) => {
    zCounter.current += 1;
    setDayWindows((prev) =>
      prev.map((w) =>
        w.dateKey === dateKey ? { ...w, z: zCounter.current } : w
      )
    );
  };

  const onWindowHeaderPointerDown = (
    e: React.PointerEvent,
    dateKey: string
  ) => {
    // Don't start a drag from buttons inside the header
    if ((e.target as HTMLElement).closest("button")) return;
    const win = dayWindows.find((w) => w.dateKey === dateKey);
    if (!win) return;
    e.preventDefault();
    bringWindowToFront(dateKey);
    dragWindowRef.current = {
      dateKey,
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onWindowHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragWindowRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setDayWindows((prev) =>
      prev.map((w) =>
        w.dateKey === d.dateKey
          ? {
              ...w,
              x: Math.max(0, d.origX + dx),
              y: Math.max(0, d.origY + dy),
            }
          : w
      )
    );
  };

  const onWindowHeaderPointerUp = (e: React.PointerEvent) => {
    if (dragWindowRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Already released
      }
    }
    dragWindowRef.current = null;
  };

  const stopLabel = (route: SavedRoute, key: RouteStopKey): string => {
    if (key.kind === "manual") {
      return (
        route.manualStops.find((s) => s.id === key.id)?.label ?? "Extra stop"
      );
    }
    return (
      customers.find((c) => c.id === key.id)?.displayName ??
      "(no longer in customer list)"
    );
  };

  const moveStop = (route: SavedRoute, index: number, delta: -1 | 1) => {
    const order = normalizedStopOrder(route);
    const j = index + delta;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    updateSavedRouteStopOrder(route.id, order);
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  const savedRoutesByDate = useMemo(() => {
    const m = new Map<string, SavedRoute[]>();
    for (const r of savedRoutes) {
      if (!r.routeDate) continue;
      const list = m.get(r.routeDate) ?? [];
      list.push(r);
      m.set(r.routeDate, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    }
    return m;
  }, [savedRoutes]);

  const routesInDisplayedWeek = useMemo(() => {
    return weekDays.reduce(
      (n, d) =>
        n + (savedRoutesByDate.get(format(d, "yyyy-MM-dd"))?.length ?? 0),
      0
    );
  }, [weekDays, savedRoutesByDate]);

  const shiftRouteDate = (route: SavedRoute, deltaDays: number) => {
    try {
      const current = parse(route.routeDate, "yyyy-MM-dd", new Date());
      if (isNaN(current.getTime())) return;
      updateSavedRouteDate(
        route.id,
        format(addDays(current, deltaDays), "yyyy-MM-dd")
      );
    } catch {
      // Unparseable legacy date — leave it alone
    }
  };

  const endDrag = () => {
    setDragRouteId(null);
    setDragOverDay(null);
  };

  const handleDropOnDay = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    const id = dragRouteId ?? e.dataTransfer.getData("text/plain");
    if (id) updateSavedRouteDate(id, dateKey);
    endDrag();
  };

  const handleDelete = (route: SavedRoute) => {
    if (confirm(`Remove “${route.name}” from saved history?`)) {
      removeSavedRoute(route.id);
    }
  };

  const renderRouteCard = useCallback(
    (r: SavedRoute) => {
      const n = r.customerIds.length + r.manualStops.length;
      return (
        <li
          key={r.id}
          draggable
          onDragStart={(e) => {
            setDragRouteId(r.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", r.id);
          }}
          onDragEnd={endDrag}
          className={`rounded border border-slate-600 bg-slate-900/70 px-2 py-1.5 ${
            dragRouteId === r.id ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 select-none shrink-0 text-base leading-none"
              title="Drag to another day"
              aria-label="Drag to another day"
            >
              ⋮⋮
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs font-medium text-slate-100 truncate"
                title={r.name}
              >
                {r.name}
              </div>
              <button
                type="button"
                onClick={() => toggleRouteStops(r.id)}
                aria-expanded={expandedRoutes.has(r.id)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                {n} stop{n !== 1 ? "s" : ""}{" "}
                {expandedRoutes.has(r.id) ? "▲" : "▼"}
              </button>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUseRoute(r)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[11px] font-medium transition-colors"
              >
                Use
              </button>
              <button
                type="button"
                onClick={() => shiftRouteDate(r, -1)}
                className="border border-slate-600 text-slate-300 hover:bg-slate-700 px-1.5 py-1 rounded text-[11px] transition-colors"
                title="Move one day earlier"
                aria-label="Move one day earlier"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => shiftRouteDate(r, 1)}
                className="border border-slate-600 text-slate-300 hover:bg-slate-700 px-1.5 py-1 rounded text-[11px] transition-colors"
                title="Move one day later"
                aria-label="Move one day later"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r)}
                className="border border-red-800/60 text-red-300 hover:bg-red-950/50 px-1.5 py-1 rounded text-[11px] transition-colors"
                title="Delete this saved route"
                aria-label="Delete this saved route"
              >
                ✕
              </button>
            </div>
          </div>

          {expandedRoutes.has(r.id) && (
            <ol className="mt-1.5 space-y-1 border-t border-slate-700 pt-1.5">
              {normalizedStopOrder(r).map((key, i, arr) => (
                <li
                  key={`${key.kind}:${key.id}`}
                  className="flex items-center gap-1.5"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-amber-300 ring-1 ring-amber-600/40 tabular-nums">
                    {routeVisitLetter(i)}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[11px] ${
                      key.kind === "manual"
                        ? "text-purple-200"
                        : "text-slate-200"
                    }`}
                    title={stopLabel(r, key)}
                  >
                    {stopLabel(r, key)}
                    {key.kind === "manual" ? " (extra)" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveStop(r, i, -1)}
                    disabled={i === 0}
                    className="border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5 rounded text-[11px] transition-colors shrink-0"
                    title="Move up"
                    aria-label="Move stop up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(r, i, 1)}
                    disabled={i === arr.length - 1}
                    className="border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5 rounded text-[11px] transition-colors shrink-0"
                    title="Move down"
                    aria-label="Move stop down"
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
          )}
        </li>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers close over stable store actions / local state
    [dragRouteId, expandedRoutes, customers, onUseRoute]
  );

  const renderDayBody = (dateKey: string, isDropTarget: boolean) => {
    const dayRoutes = savedRoutesByDate.get(dateKey) ?? [];
    if (dayRoutes.length === 0) {
      return (
        <div className="text-[11px] text-slate-600 py-0.5">
          {isDropTarget ? "Drop here" : "No routes"}
        </div>
      );
    }
    return (
      <ul className="space-y-1.5">{dayRoutes.map((r) => renderRouteCard(r))}</ul>
    );
  };

  return (
    <div className="relative">
      {/* Week navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setWeekAnchor((d) => addWeeks(d, -1))}
          className="border border-slate-500 text-slate-200 hover:bg-slate-600 px-3 py-1.5 rounded text-sm transition-colors"
          aria-label="Previous week"
        >
          ◀
        </button>
        <span className="text-sm font-semibold text-slate-100">
          {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
          className="border border-slate-500 text-slate-200 hover:bg-slate-600 px-3 py-1.5 rounded text-sm transition-colors"
          aria-label="Next week"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setWeekAnchor(new Date())}
          className="border border-slate-500 text-slate-200 hover:bg-slate-600 px-3 py-1.5 rounded text-sm transition-colors"
        >
          This week
        </button>
        {dayWindows.length > 0 && (
          <button
            type="button"
            onClick={() => setDayWindows([])}
            className="border border-slate-500 text-slate-300 hover:bg-slate-600 px-3 py-1.5 rounded text-sm transition-colors sm:ml-auto"
          >
            Close all windows ({dayWindows.length})
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">
        {routesInDisplayedWeek} route{routesInDisplayedWeek !== 1 ? "s" : ""}{" "}
        this week
        {savedRoutes.length > routesInDisplayedWeek
          ? ` · ${savedRoutes.length - routesInDisplayedWeek} on other dates`
          : ""}
        . Use <strong className="text-slate-300">Pop out</strong> to open a day
        in its own window — open several and edit each side by side.
      </p>

      {/* Days as collapsible rows */}
      <div className="space-y-2">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayRoutes = savedRoutesByDate.get(dateKey) ?? [];
          const today = isToday(day);
          const isDropTarget = dragOverDay === dateKey && dragRouteId !== null;
          const expanded = expandedDays.has(dateKey) || isDropTarget;
          const isPoppedOut = dayWindows.some((w) => w.dateKey === dateKey);
          return (
            <div
              key={dateKey}
              onDragOver={(e) => {
                if (!dragRouteId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverDay(dateKey);
              }}
              onDragLeave={() => {
                if (dragOverDay === dateKey) setDragOverDay(null);
              }}
              onDrop={(e) => handleDropOnDay(e, dateKey)}
              className={`rounded border transition-colors ${
                isDropTarget
                  ? "border-amber-400 bg-amber-900/20"
                  : today
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-slate-600 bg-slate-800/70"
              }`}
            >
              <div className="flex items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={() => toggleDay(dateKey)}
                  aria-expanded={expanded}
                  className="flex-1 flex items-center justify-between gap-2 px-1.5 py-2 text-left min-w-0"
                >
                  <span
                    className={`text-xs font-semibold truncate ${
                      today ? "text-blue-300" : "text-slate-300"
                    }`}
                  >
                    {format(day, "EEEE")}{" "}
                    <span
                      className={today ? "text-blue-200" : "text-slate-400"}
                    >
                      {format(day, "M/d")}
                    </span>
                    {today ? " · Today" : ""}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] ${
                        dayRoutes.length > 0
                          ? "text-slate-300"
                          : "text-slate-600"
                      }`}
                    >
                      {dayRoutes.length} route
                      {dayRoutes.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {expanded ? "▲" : "▼"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openDayWindow(dateKey)}
                  className={`shrink-0 text-[11px] font-medium px-2 py-1.5 rounded border transition-colors ${
                    isPoppedOut
                      ? "border-amber-500/70 bg-amber-900/40 text-amber-100"
                      : "border-slate-500 text-slate-300 hover:bg-slate-700"
                  }`}
                  title={
                    isPoppedOut
                      ? "Bring this day's window to the front"
                      : "Open this day in its own window"
                  }
                >
                  {isPoppedOut ? "Focus" : "Pop out"}
                </button>
              </div>

              {expanded && !isPoppedOut && (
                <div className="px-2 pb-2">
                  {renderDayBody(dateKey, isDropTarget)}
                </div>
              )}
              {expanded && isPoppedOut && (
                <div className="px-2 pb-2 text-[11px] text-amber-200/80">
                  Editing in a floating window — drag its title bar to move it.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {savedRoutes.length === 0 && (
        <p className="text-sm text-slate-500 mt-3">
          No saved routes yet. Build a route on the Routes page and save it —
          it will show up on its route date here.
        </p>
      )}

      {/* Floating day windows — portaled to body so they escape Map dropdown overflow */}
      {mounted &&
        createPortal(
          <>
            {dayWindows.map((win) => {
              const day = parse(win.dateKey, "yyyy-MM-dd", new Date());
              const today = isToday(day);
              const dayRoutes = savedRoutesByDate.get(win.dateKey) ?? [];
              const isDropTarget =
                dragOverDay === win.dateKey && dragRouteId !== null;
              return (
                <div
                  key={win.dateKey}
                  style={{
                    position: "fixed",
                    left: win.x,
                    top: win.y,
                    zIndex: 80 + win.z,
                  }}
                  onMouseDown={() => bringWindowToFront(win.dateKey)}
                  onDragOver={(e) => {
                    if (!dragRouteId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverDay(win.dateKey);
                  }}
                  onDragLeave={() => {
                    if (dragOverDay === win.dateKey) setDragOverDay(null);
                  }}
                  onDrop={(e) => handleDropOnDay(e, win.dateKey)}
                  className={`w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70vh,32rem)] flex flex-col rounded-lg border shadow-2xl overflow-hidden ${
                    isDropTarget
                      ? "border-amber-400 bg-slate-800"
                      : today
                        ? "border-blue-500 bg-slate-800"
                        : "border-slate-500 bg-slate-800"
                  }`}
                >
                  <div
                    onPointerDown={(e) =>
                      onWindowHeaderPointerDown(e, win.dateKey)
                    }
                    onPointerMove={onWindowHeaderPointerMove}
                    onPointerUp={onWindowHeaderPointerUp}
                    onPointerCancel={onWindowHeaderPointerUp}
                    className={`flex items-center justify-between gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none shrink-0 ${
                      today ? "bg-blue-950/60" : "bg-slate-700"
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold truncate ${
                          today ? "text-blue-100" : "text-slate-100"
                        }`}
                      >
                        {format(day, "EEEE")} · {format(day, "MMM d")}
                        {today ? " · Today" : ""}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {dayRoutes.length} route
                        {dayRoutes.length !== 1 ? "s" : ""} · drag title to move
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeDayWindow(win.dateKey)}
                      className="shrink-0 border border-slate-500 text-slate-200 hover:bg-slate-600 px-2 py-1 rounded text-xs"
                      aria-label={`Close ${format(day, "EEEE")} window`}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 min-h-0">
                    {renderDayBody(win.dateKey, isDropTarget)}
                  </div>
                </div>
              );
            })}
          </>,
          document.body
        )}
    </div>
  );
}
