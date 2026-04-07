import type { ManualRouteStop } from "./manual-stop";
import type { RouteStartPoint, RouteStopKey } from "./route-plan";

/** Snapshot of a route for history / reuse */
export type SavedRoute = {
  id: string;
  /** When the user saved this snapshot */
  savedAt: string;
  name: string;
  /** yyyy-MM-dd from the route form */
  routeDate: string;
  customerIds: string[];
  manualStops: ManualRouteStop[];
  /** Map visit order (optional for entries saved before this existed) */
  routeStopOrder?: RouteStopKey[];
  routeStart?: RouteStartPoint | null;
};
