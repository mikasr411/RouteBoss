export type ManualRouteStop = {
  id: string;
  /** Full address string used for geocoding / export */
  address: string;
  /** Short label shown in lists (e.g. "Extra stop") */
  label: string;
  lat: number;
  lng: number;
};
