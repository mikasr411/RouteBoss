/** Ordered leg on the driving route (customers + manual stops) */
export type RouteStopKey = {
  kind: "customer" | "manual";
  id: string;
};

/** Optional depot / home base — prepended before ordered stops in directions */
export type RouteStartPoint = {
  id: string;
  address: string;
  label: string;
  lat: number;
  lng: number;
};
