"use client";

import { useMemo, useState } from "react";
import {
  format,
  parse,
  startOfWeek,
  addDays,
  addWeeks,
  isToday,
} from "date-fns";
import { useRouteHistoryStore } from "@/store/route-history-store";
import type { SavedRoute } from "@/types/saved-route";

type Props = {
  /** Called after the user picks a route to load (e.g. apply + navigate) */
  onUseRoute: (route: SavedRoute) => void;
};

/**
 * Week planner: days listed vertically, saved routes shown on their route
 * date. Routes can be dragged onto another day (or moved with ◀ ▶).
 */
export default function WeekRoutePlanner({ onUseRoute }: Props) {
  const { savedRoutes, removeSavedRoute, updateSavedRouteDate } =
    useRouteHistoryStore();
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [dragRouteId, setDragRouteId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

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

  return (
    <div>
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
      </div>
      <p className="text-xs text-slate-400 mb-3">
        {routesInDisplayedWeek} route{routesInDisplayedWeek !== 1 ? "s" : ""}{" "}
        this week
        {savedRoutes.length > routesInDisplayedWeek
          ? ` · ${savedRoutes.length - routesInDisplayedWeek} on other dates`
          : ""}
        . Drag a route onto another day to reschedule it.
      </p>

      {/* Days as a vertical list */}
      <div className="space-y-2">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayRoutes = savedRoutesByDate.get(dateKey) ?? [];
          const today = isToday(day);
          const isDropTarget = dragOverDay === dateKey && dragRouteId !== null;
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
              className={`rounded border p-2 transition-colors ${
                isDropTarget
                  ? "border-amber-400 bg-amber-900/20"
                  : today
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-slate-600 bg-slate-800/70"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-semibold ${
                    today ? "text-blue-300" : "text-slate-300"
                  }`}
                >
                  {format(day, "EEEE")}{" "}
                  <span className={today ? "text-blue-200" : "text-slate-400"}>
                    {format(day, "M/d")}
                  </span>
                  {today ? " · Today" : ""}
                </span>
                {dayRoutes.length > 0 && (
                  <span className="text-[11px] text-slate-500">
                    {dayRoutes.length} route{dayRoutes.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {dayRoutes.length === 0 ? (
                <div className="text-[11px] text-slate-600 py-0.5">
                  {isDropTarget ? "Drop here" : "No routes"}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {dayRoutes.map((r) => {
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
                        className={`flex items-center gap-2 rounded border border-slate-600 bg-slate-900/70 px-2 py-1.5 ${
                          dragRouteId === r.id ? "opacity-50" : ""
                        }`}
                      >
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
                          <div className="text-[11px] text-slate-400">
                            {n} stop{n !== 1 ? "s" : ""}
                          </div>
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
                      </li>
                    );
                  })}
                </ul>
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
    </div>
  );
}
