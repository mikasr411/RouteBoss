"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCustomerStore } from "@/store/customer-store";
import { Customer } from "@/types/customer";
import { formatDate, isCustomerDue } from "@/lib/utils";
import { geocodeAddress, hasCoordinates } from "@/lib/geocoding";
import MapLoader from "@/components/map/MapLoader";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { v4 as uuidv4 } from "uuid";
import { ManualRouteStop } from "@/types/manual-stop";
import { routeVisitLetter } from "@/lib/route-visit-letter";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
} as const;

const defaultCenter = {
  lat: 36.7378, // Fresno area
  lng: -119.7871,
};

const defaultZoom = 10;

// Marker colors based on status
const getMarkerColor = (customer: Customer): string => {
  // Green: Selected for route
  if (customer.isSelectedForRoute) return "#10b981"; // Green
  // Red: Due for service
  if (isCustomerDue(customer)) return "#ef4444"; // Red
  // Blue: All others
  return "#3b82f6"; // Blue
};

// Create custom marker icon (must be called when google.maps is available)
// Fixed size - doesn't scale with zoom
const createMarkerIcon = (color: string): any => {
  if (typeof window === "undefined") return null;
  const google = (window as any).google;
  if (!google?.maps) return null;
  
  // Always create a new icon object to ensure React detects changes
  const icon: any = {
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    // Use scaledSize for fixed pixel size (doesn't scale with zoom)
    scaledSize: google.maps.Size ? new google.maps.Size(32, 32) : undefined,
    // Use size for the base size
    size: google.maps.Size ? new google.maps.Size(32, 32) : undefined,
  };
  
  // Use SymbolPath.CIRCLE if available, otherwise use a simple circle SVG path
  if (google.maps.SymbolPath?.CIRCLE) {
    icon.path = google.maps.SymbolPath.CIRCLE;
  } else {
    // Fallback: simple circle SVG path
    icon.path = "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0";
  }
  
  // Only add anchor if Point is available (center of the circle)
  if (google.maps.Point) {
    icon.anchor = new google.maps.Point(16, 16);
  }
  
  return icon;
};

const LABELED_MARKER_PX = 36;

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One pin: colored circle + letter (no separate Maps `label` bubble). */
function createLabeledCircleIcon(color: string, label: string): any {
  if (typeof window === "undefined") return null;
  const google = (window as any).google;
  if (!google?.maps?.Size || !google?.maps?.Point) return null;

  const safe = escapeSvgText(label);
  const n = label.length;
  const fontSize = n <= 1 ? 14 : n === 2 ? 11 : 9;
  const s = LABELED_MARKER_PX;
  const c = s / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${c}" cy="${c}" r="15" fill="${color}" stroke="#ffffff" stroke-width="2"/><text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-weight="700" font-size="${fontSize}">${safe}</text></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return {
    url,
    scaledSize: new google.maps.Size(s, s),
    anchor: new google.maps.Point(c, c),
  };
}

function markerIconForColorAndLabel(color: string, letter: string | undefined) {
  if (letter) {
    const labeled = createLabeledCircleIcon(color, letter);
    if (labeled) return labeled;
  }
  return createMarkerIcon(color);
}

const PREVIEW_MARKER_ID = "__address_preview__";
const START_MARKER_ID = "__route_start__";

type PlaceSuggestion = {
  placeId: string;
  description: string;
};

export default function MapPage() {
  const {
    customers,
    updateCustomer,
    manualStops,
    addManualStop,
    removeManualStop,
    routeStopOrder,
    routeStart,
    syncRouteStopOrder,
    setRouteStopOrder,
    setRouteStart,
    clearRouteStart,
  } = useCustomerStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [geocodingProgress, setGeocodingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [directionsResult, setDirectionsResult] =
    useState<any | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const mapRef = useRef<any | null>(null);
  const directionsServiceRef = useRef<any | null>(null);
  const placesAutocompleteRef = useRef<any | null>(null);
  const routeDragFromIndex = useRef<number | null>(null);
  const [routeDragOverIndex, setRouteDragOverIndex] = useState<number | null>(
    null
  );
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  /** After choosing “tap another route pin”, next route marker click sets position. */
  const [routeMoveAwaitingTargetFromIndex, setRouteMoveAwaitingTargetFromIndex] =
    useState<number | null>(null);

  /** Address lookup (ad-hoc stop) */
  const [addressLookupInput, setAddressLookupInput] = useState("");
  const [addressLookupLabel, setAddressLookupLabel] = useState("Extra stop");
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>(
    []
  );
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(
    null
  );
  const [addressPreview, setAddressPreview] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  /** Starting point (depot / home base) */
  const [startAddressInput, setStartAddressInput] = useState("");
  const [startLabelInput, setStartLabelInput] = useState("Starting point");
  const [startLookupLoading, setStartLookupLoading] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [startLookupError, setStartLookupError] = useState<string | null>(null);

  // Get unique cities
  const cities = useMemo(() => {
    const citySet = new Set(customers.map((c) => c.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [customers]);

  // Filter customers
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

    return filtered;
  }, [customers, searchQuery, selectedCity, selectedFrequency, dueOnly]);

  // Customers with coordinates
  const customersWithCoords = useMemo(() => {
    return filteredCustomers.filter(hasCoordinates);
  }, [filteredCustomers]);

  // Create marker icons for all customers (memoized)
  const markerIcons = useMemo(() => {
    const icons: Record<string, any> = {};
    customersWithCoords.forEach((customer) => {
      const color = getMarkerColor(customer);
      const icon = createMarkerIcon(color);
      // Only store if icon was successfully created
      if (icon) {
        icons[customer.id] = icon;
      }
    });
    return icons;
  }, [customersWithCoords]);

  // Selected customers for route
  const selectedForRoute = useMemo(() => {
    return customersWithCoords.filter((c) => c.isSelectedForRoute);
  }, [customersWithCoords]);

  useEffect(() => {
    syncRouteStopOrder();
  }, [customers, manualStops, syncRouteStopOrder]);

  const routeStopLetterByKey = useMemo(() => {
    const m = new Map<string, string>();
    routeStopOrder.forEach((k, i) => {
      m.set(`${k.kind}:${k.id}`, routeVisitLetter(i));
    });
    return m;
  }, [routeStopOrder]);

  const routeStopIndexByKey = useMemo(() => {
    const m = new Map<string, number>();
    routeStopOrder.forEach((k, i) => {
      m.set(`${k.kind}:${k.id}`, i);
    });
    return m;
  }, [routeStopOrder]);

  // Driving path: optional start, then ordered stops (respects drag / ↑↓ on Map)
  const orderedRoutePoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (routeStart) {
      pts.push({ lat: routeStart.lat, lng: routeStart.lng });
    }
    for (const key of routeStopOrder) {
      if (key.kind === "customer") {
        const c = customers.find((x) => x.id === key.id);
        if (c && hasCoordinates(c)) {
          pts.push({ lat: c.latitude!, lng: c.longitude! });
        }
      } else {
        const s = manualStops.find((x) => x.id === key.id);
        if (s) pts.push({ lat: s.lat, lng: s.lng });
      }
    }
    return pts;
  }, [routeStopOrder, customers, manualStops, routeStart]);

  const routeStopsWithCoords = useMemo(() => {
    const stops: Array<{
      key: (typeof routeStopOrder)[number];
      lat: number;
      lng: number;
    }> = [];
    for (const key of routeStopOrder) {
      if (key.kind === "customer") {
        const c = customers.find((x) => x.id === key.id);
        if (c && hasCoordinates(c)) {
          stops.push({ key, lat: c.latitude!, lng: c.longitude! });
        }
      } else {
        const s = manualStops.find((x) => x.id === key.id);
        if (s) stops.push({ key, lat: s.lat, lng: s.lng });
      }
    }
    return stops;
  }, [routeStopOrder, customers, manualStops]);

  // Geocode statistics
  const geocodeStats = useMemo(() => {
    const withCoords = customers.filter(hasCoordinates).length;
    const withoutCoords = customers.filter((c) => !hasCoordinates(c)).length;
    return { withCoords, withoutCoords };
  }, [customers]);

  // Calculate map center from customers
  const mapCenter = useMemo(() => {
    if (customersWithCoords.length === 0) return defaultCenter;

    const avgLat =
      customersWithCoords.reduce((sum, c) => sum + (c.latitude || 0), 0) /
      customersWithCoords.length;
    const avgLng =
      customersWithCoords.reduce((sum, c) => sum + (c.longitude || 0), 0) /
      customersWithCoords.length;

    return { lat: avgLat, lng: avgLng };
  }, [customersWithCoords]);

  // Geocode missing addresses
  const handleGeocodeMissing = useCallback(async () => {
    const missing = customers.filter((c) => !hasCoordinates(c));
    if (missing.length === 0) {
      alert("All customers already have coordinates!");
      return;
    }

    setGeocodingProgress({ current: 0, total: missing.length });

    for (let i = 0; i < missing.length; i++) {
      const customer = missing[i];
      const coords = await geocodeAddress(customer.fullAddress);

      if (coords) {
        updateCustomer(customer.id, {
          latitude: coords.lat,
          longitude: coords.lng,
        });
      }

      setGeocodingProgress({ current: i + 1, total: missing.length });

      // Delay to avoid rate limiting
      if (i < missing.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setGeocodingProgress(null);
    alert(`Geocoding complete! ${missing.length} addresses processed.`);
  }, [customers, updateCustomer]);

  // Calculate route with Directions API (start + ordered stops; order is fixed, not optimized)
  const calculateRoute = useCallback(() => {
    if (orderedRoutePoints.length < 2) {
      setDirectionsResult(null);
      setDirectionsError(null);
      return;
    }

    if (typeof window === "undefined" || !(window as any).google?.maps) {
      setDirectionsError("Google Maps API not loaded");
      return;
    }

    const google = (window as any).google;

    if (!google.maps.DirectionsService) {
      setDirectionsError("Directions API not available");
      return;
    }

    if (!directionsServiceRef.current) {
      try {
        directionsServiceRef.current = new google.maps.DirectionsService();
      } catch (error) {
        setDirectionsError("Failed to initialize Directions Service");
        return;
      }
    }

    const first = orderedRoutePoints[0];
    const last = orderedRoutePoints[orderedRoutePoints.length - 1];
    const waypoints = orderedRoutePoints.slice(1, -1).map((p) => ({
      location: { lat: p.lat, lng: p.lng },
      stopover: true,
    }));

    const request: any = {
      origin: { lat: first.lat, lng: first.lng },
      destination: { lat: last.lat, lng: last.lng },
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING,
    };

    directionsServiceRef.current.route(request, (result: any, status: any) => {
      if (status === "OK" && result) {
        setDirectionsResult(result);
        setDirectionsError(null);
      } else {
        setDirectionsError(
          `Directions request failed: ${status}. You may have hit rate limits.`
        );
        setDirectionsResult(null);
      }
    });
  }, [orderedRoutePoints]);

  // Recalculate route when selection changes (only after map is loaded)
  useEffect(() => {
    if (orderedRoutePoints.length >= 2 && mapRef.current) {
      const timer = setTimeout(() => {
        calculateRoute();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDirectionsResult(null);
      setDirectionsError(null);
    }
  }, [orderedRoutePoints.length, calculateRoute]);

  // Pan to customer
  const panToCustomer = useCallback(
    (customer: Customer) => {
      if (!mapRef.current || !hasCoordinates(customer)) return;

      mapRef.current.panTo({
        lat: customer.latitude!,
        lng: customer.longitude!,
      });
      mapRef.current.setZoom(14);
      setSelectedMarkerId(customer.id);
    },
    []
  );

  // Toggle route selection
  const toggleRouteSelection = useCallback(
    (customerId: string) => {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) return;

      updateCustomer(customerId, {
        isSelectedForRoute: !customer.isSelectedForRoute,
      });
    },
    [customers, updateCustomer]
  );

  const getAutocompleteService = useCallback(() => {
    if (typeof window === "undefined") return null;
    const google = (window as any).google;
    if (!google?.maps?.places?.AutocompleteService) return null;
    if (!placesAutocompleteRef.current) {
      placesAutocompleteRef.current = new google.maps.places.AutocompleteService();
    }
    return placesAutocompleteRef.current;
  }, []);

  const fetchAddressSuggestions = useCallback(
    (value: string) => {
      const q = value.trim();
      if (q.length < 3) {
        setAddressSuggestions([]);
        return;
      }
      const svc = getAutocompleteService();
      if (!svc) return;
      const google = (window as any).google;
      svc.getPlacePredictions(
        { input: q, types: ["address"] },
        (predictions: any[] | null, status: any) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            setAddressSuggestions([]);
            return;
          }
          setAddressSuggestions(
            predictions.slice(0, 6).map((p) => ({
              placeId: p.place_id,
              description: p.description,
            }))
          );
        }
      );
    },
    [getAutocompleteService]
  );

  const fetchStartSuggestions = useCallback(
    (value: string) => {
      const q = value.trim();
      if (q.length < 3) {
        setStartSuggestions([]);
        return;
      }
      const svc = getAutocompleteService();
      if (!svc) return;
      const google = (window as any).google;
      svc.getPlacePredictions(
        { input: q, types: ["address"] },
        (predictions: any[] | null, status: any) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            setStartSuggestions([]);
            return;
          }
          setStartSuggestions(
            predictions.slice(0, 6).map((p) => ({
              placeId: p.place_id,
              description: p.description,
            }))
          );
        }
      );
    },
    [getAutocompleteService]
  );

  const locateAddress = useCallback(async (rawAddress: string) => {
    const q = rawAddress.trim();
    if (!q) {
      setAddressLookupError("Enter an address");
      return;
    }
    setAddressLookupLoading(true);
    setAddressLookupError(null);
    setAddressPreview(null);
    try {
      const coords = await geocodeAddress(q);
      if (!coords) {
        setAddressLookupError("Could not find that address. Try a fuller address.");
        return;
      }
      setAddressPreview({ lat: coords.lat, lng: coords.lng, address: q });
      setSelectedMarkerId(PREVIEW_MARKER_ID);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: coords.lat, lng: coords.lng });
        mapRef.current.setZoom(15);
      }
    } finally {
      setAddressLookupLoading(false);
    }
  }, []);

  const handleAddressLookup = useCallback(async () => {
    await locateAddress(addressLookupInput);
  }, [addressLookupInput, locateAddress]);

  const handleAddPreviewToRoute = useCallback(() => {
    if (!addressPreview) return;
    const label = addressLookupLabel.trim() || "Extra stop";
    const stop: ManualRouteStop = {
      id: uuidv4(),
      address: addressPreview.address,
      label,
      lat: addressPreview.lat,
      lng: addressPreview.lng,
    };
    addManualStop(stop);
    setAddressPreview(null);
    setAddressLookupInput("");
    setSelectedMarkerId(null);
  }, [addressPreview, addressLookupLabel, addManualStop]);

  const locateAndSaveStart = useCallback(async (rawAddress: string) => {
    const q = rawAddress.trim();
    if (!q) {
      setStartLookupError("Enter a starting address");
      return;
    }
    setStartLookupLoading(true);
    setStartLookupError(null);
    try {
      const coords = await geocodeAddress(q);
      if (!coords) {
        setStartLookupError("Could not find that address. Try a fuller address.");
        return;
      }
      setRouteStart({
        id: uuidv4(),
        address: q,
        label: startLabelInput.trim() || "Starting point",
        lat: coords.lat,
        lng: coords.lng,
      });
      setSelectedMarkerId(START_MARKER_ID);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: coords.lat, lng: coords.lng });
        mapRef.current.setZoom(12);
      }
    } finally {
      setStartLookupLoading(false);
    }
  }, [startLabelInput, setRouteStart]);

  const handleLocateAndSaveStart = useCallback(async () => {
    await locateAndSaveStart(startAddressInput);
  }, [locateAndSaveStart, startAddressInput]);

  const removeStopFromRoute = useCallback(
    (kind: "customer" | "manual", id: string) => {
      if (kind === "customer") {
        updateCustomer(id, { isSelectedForRoute: false });
      } else {
        removeManualStop(id);
      }
    },
    [updateCustomer, removeManualStop]
  );

  const endRouteDrag = useCallback(() => {
    routeDragFromIndex.current = null;
    setRouteDragOverIndex(null);
  }, []);

  const reorderRouteStops = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const prev = useCustomerStore.getState().routeStopOrder;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      setRouteStopOrder(next);
    },
    [setRouteStopOrder]
  );

  const handleOptimizeRoute = useCallback(() => {
    if (!routeStart) {
      setDirectionsError("Set a starting point before optimizing the route.");
      return;
    }
    if (routeStopsWithCoords.length < 2) {
      setDirectionsError(
        "Add at least 2 route stops to optimize from the starting point."
      );
      return;
    }
    if (typeof window === "undefined" || !(window as any).google?.maps) {
      setDirectionsError("Google Maps API not loaded");
      return;
    }

    const google = (window as any).google;
    if (!google.maps.DirectionsService) {
      setDirectionsError("Directions API not available");
      return;
    }
    if (!directionsServiceRef.current) {
      try {
        directionsServiceRef.current = new google.maps.DirectionsService();
      } catch {
        setDirectionsError("Failed to initialize Directions Service");
        return;
      }
    }

    const destination = routeStopsWithCoords[routeStopsWithCoords.length - 1];
    const waypointStops = routeStopsWithCoords.slice(0, -1);

    setIsOptimizingRoute(true);
    setDirectionsError(null);
    directionsServiceRef.current.route(
      {
        origin: { lat: routeStart.lat, lng: routeStart.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints: waypointStops.map((s) => ({
          location: { lat: s.lat, lng: s.lng },
          stopover: true,
        })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: any) => {
        setIsOptimizingRoute(false);
        if (status === "OK" && result) {
          const optimizedWaypointOrder: number[] =
            result.routes?.[0]?.waypoint_order ?? [];
          if (optimizedWaypointOrder.length !== waypointStops.length) {
            setDirectionsError(
              "Could not optimize route order right now. Please try again."
            );
            return;
          }
          const nextOrder = [
            ...optimizedWaypointOrder.map((i) => waypointStops[i].key),
            destination.key,
          ];
          setRouteStopOrder(nextOrder);
          setDirectionsResult(result);
          setDirectionsError(null);
          return;
        }
        setDirectionsError(`Route optimization failed: ${status}.`);
      }
    );
  }, [routeStart, routeStopsWithCoords, setRouteStopOrder]);

  const onRouteStopMarkerClick = useCallback(
    (keyStr: string, markerId: string) => {
      const idx = routeStopIndexByKey.get(keyStr);
      if (routeMoveAwaitingTargetFromIndex !== null) {
        if (idx !== undefined) {
          const from = routeMoveAwaitingTargetFromIndex;
          if (from !== idx) {
            reorderRouteStops(from, idx);
          }
          setRouteMoveAwaitingTargetFromIndex(null);
          setSelectedMarkerId(markerId);
          return;
        }
        setRouteMoveAwaitingTargetFromIndex(null);
      }
      setSelectedMarkerId(markerId);
    },
    [
      routeMoveAwaitingTargetFromIndex,
      routeStopIndexByKey,
      reorderRouteStops,
    ]
  );

  useEffect(() => {
    if (routeMoveAwaitingTargetFromIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRouteMoveAwaitingTargetFromIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [routeMoveAwaitingTargetFromIndex]);

  // Google Maps often needs a resize after the container gets a real size (mobile layout).
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const g = typeof window !== "undefined" ? window.google?.maps : undefined;
    if (!g?.event) return;

    const triggerResize = () => {
      g.event.trigger(map, "resize");
    };

    triggerResize();
    const t1 = window.setTimeout(triggerResize, 100);
    const t2 = window.setTimeout(triggerResize, 400);
    window.addEventListener("resize", triggerResize);
    return () => {
      window.removeEventListener("resize", triggerResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isMapLoaded]);

  function RouteMoveInMapInfo({ fromIndex }: { fromIndex: number }) {
    if (routeStopOrder.length < 2) return null;
    return (
      <div className="mt-2 pt-2 border-t border-slate-300">
        <p className="text-[11px] font-semibold text-slate-700 mb-1">
          Move this stop to
        </p>
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {routeStopOrder.map((_, i) => {
            const L = routeVisitLetter(i);
            const isHere = i === fromIndex;
            return (
              <button
                key={i}
                type="button"
                disabled={isHere}
                onClick={() => {
                  reorderRouteStops(fromIndex, i);
                  setSelectedMarkerId(null);
                }}
                className={`min-w-[1.625rem] px-1.5 py-1 rounded text-[11px] font-bold tabular-nums ${
                  isHere
                    ? "bg-amber-100 text-amber-900 ring-1 ring-amber-400 cursor-default"
                    : "bg-amber-600 text-white hover:bg-amber-500"
                }`}
              >
                {L}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-2 w-full text-left text-[11px] font-medium text-cyan-800 hover:underline"
          onClick={() => {
            setRouteMoveAwaitingTargetFromIndex(fromIndex);
            setSelectedMarkerId(null);
          }}
        >
          Or tap another route pin on the map
        </button>
      </div>
    );
  }

  return (
    <MapLoader>
      <div className="flex flex-col h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-4rem)] min-h-[300px] w-full max-w-full min-w-0 overflow-hidden bg-slate-900">
        {/* Header */}
        <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-3 sm:px-4 py-2 sm:py-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
            Map View
          </h1>
        </div>

        <div className="flex flex-1 flex-col md:flex-row min-h-0 min-w-0 overflow-hidden">
          {/* Sidebar — below map on mobile, left column on md+ */}
          <div className="flex flex-col order-2 md:order-1 w-full min-w-0 md:w-80 md:max-w-[20rem] md:shrink-0 flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-slate-800 border-t md:border-t-0 md:border-r border-slate-700">
            {/* Geocode Management */}
            <div className="p-3 sm:p-4 border-b border-slate-700 order-2 md:order-none shrink-0">
              <div className="text-sm text-slate-400 mb-2">
                <div>With coordinates: {geocodeStats.withCoords}</div>
                <div>Missing coordinates: {geocodeStats.withoutCoords}</div>
              </div>
              {geocodeStats.withoutCoords > 0 && (
                <button
                  onClick={handleGeocodeMissing}
                  disabled={!!geocodingProgress}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  {geocodingProgress
                    ? `Geocoding ${geocodingProgress.current}/${geocodingProgress.total}...`
                    : "Geocode Missing Addresses"}
                </button>
              )}
            </div>

            {/* Locate address (add to route) — first under map on mobile */}
            <div className="p-3 sm:p-4 border-b border-slate-700 space-y-2 order-1 md:order-none shrink-0 bg-slate-800/95">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                Locate address
              </div>
              <p className="text-xs text-slate-500">
                Search an address, preview on the map, then add it to your route.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={addressLookupInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAddressLookupInput(v);
                    setShowAddressSuggestions(true);
                    fetchAddressSuggestions(v);
                  }}
                  onFocus={() => {
                    setShowAddressSuggestions(true);
                    fetchAddressSuggestions(addressLookupInput);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowAddressSuggestions(false), 120);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowAddressSuggestions(false);
                      handleAddressLookup();
                    }
                  }}
                  placeholder="123 Main St, City, ST"
                  autoComplete="off"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showAddressSuggestions && addressSuggestions.length > 0 ? (
                  <div className="absolute z-20 mt-1 w-full rounded border border-slate-600 bg-slate-800 shadow-xl overflow-hidden">
                    {addressSuggestions.map((s) => (
                      <button
                        key={s.placeId}
                        type="button"
                        className="w-full text-left px-2 py-2 text-sm text-slate-100 hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                        onMouseDown={() => {
                          setAddressLookupInput(s.description);
                          setAddressSuggestions([]);
                          setShowAddressSuggestions(false);
                          locateAddress(s.description);
                        }}
                      >
                        {s.description}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                type="text"
                value={addressLookupLabel}
                onChange={(e) => setAddressLookupLabel(e.target.value)}
                placeholder="Label (e.g. Supplier)"
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddressLookup}
                disabled={addressLookupLoading}
                className="w-full bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white px-3 py-2.5 rounded text-sm font-medium transition-colors"
              >
                {addressLookupLoading ? "Locating…" : "Locate on map"}
              </button>
              {addressLookupError && (
                <p className="text-xs text-red-400">{addressLookupError}</p>
              )}
              {addressPreview && (
                <div className="rounded border border-amber-600/50 bg-amber-900/20 p-2 space-y-2">
                  <p className="text-xs text-amber-100 line-clamp-3">
                    {addressPreview.address}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddPreviewToRoute}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-sm font-medium"
                  >
                    Add to route
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressPreview(null);
                      setSelectedMarkerId(null);
                    }}
                    className="w-full text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Clear preview
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="p-3 sm:p-4 border-b border-slate-700 order-4 md:order-none shrink-0">
              <div className="text-sm text-slate-300">
                <div>Visible customers: {customersWithCoords.length}</div>
                <div>
                  Selected for route: {selectedForRoute.length} customers
                  {manualStops.length > 0
                    ? ` + ${manualStops.length} extra`
                    : ""}
                </div>
              </div>
              {directionsError && (
                <div className="mt-2 text-xs text-red-400">{directionsError}</div>
              )}
            </div>

            {/* Starting point + ordered stops on route */}
            <div className="p-3 sm:p-4 border-b border-slate-700 order-5 md:order-none shrink-0 space-y-3">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                Starting point
              </div>
              <p className="text-xs text-slate-500">
                Optional depot or home base. Driving directions go: start → stops
                in the order listed below.
              </p>
              <input
                type="text"
                value={startLabelInput}
                onChange={(e) => setStartLabelInput(e.target.value)}
                placeholder="Label (e.g. Shop)"
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
              />
              <div className="relative">
                <input
                  type="text"
                  value={startAddressInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartAddressInput(v);
                    setShowStartSuggestions(true);
                    fetchStartSuggestions(v);
                  }}
                  onFocus={() => {
                    setShowStartSuggestions(true);
                    fetchStartSuggestions(startAddressInput);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowStartSuggestions(false), 120);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setShowStartSuggestions(false);
                      handleLocateAndSaveStart();
                    }
                  }}
                  placeholder="123 Main St, City, ST"
                  autoComplete="off"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                />
                {showStartSuggestions && startSuggestions.length > 0 ? (
                  <div className="absolute z-20 mt-1 w-full rounded border border-slate-600 bg-slate-800 shadow-xl overflow-hidden">
                    {startSuggestions.map((s) => (
                      <button
                        key={s.placeId}
                        type="button"
                        className="w-full text-left px-2 py-2 text-sm text-slate-100 hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                        onMouseDown={() => {
                          setStartAddressInput(s.description);
                          setStartSuggestions([]);
                          setShowStartSuggestions(false);
                          locateAndSaveStart(s.description);
                        }}
                      >
                        {s.description}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleLocateAndSaveStart}
                disabled={startLookupLoading}
                className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                {startLookupLoading ? "Locating…" : "Locate & save starting point"}
              </button>
              {startLookupError && (
                <p className="text-xs text-red-400">{startLookupError}</p>
              )}
              {routeStart && (
                <div className="rounded border border-cyan-600/40 bg-cyan-950/25 p-2 space-y-2">
                  <div>
                    <div className="text-xs font-bold text-cyan-300/90 mb-1">
                      Map pin label: S
                    </div>
                    <div className="text-sm font-medium text-cyan-200">
                      {routeStart.label}
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-2">
                      {routeStart.address}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearRouteStart();
                      setSelectedMarkerId(null);
                    }}
                    className="w-full text-xs border border-slate-500 text-slate-300 hover:bg-slate-700 py-1.5 rounded"
                  >
                    Clear starting point
                  </button>
                </div>
              )}

              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide pt-2 border-t border-slate-600">
                On this route ({routeStopOrder.length})
              </div>
              <p className="text-xs text-slate-500">
                Visit order is <strong className="text-slate-300">A</strong>,{" "}
                <strong className="text-slate-300">B</strong>,{" "}
                <strong className="text-slate-300">C</strong>… on map pins and on
                the Routes page. Starting point (if set) shows{" "}
                <strong className="text-slate-300">S</strong>. Drag ⋮⋮ to reorder.
              </p>
              <button
                type="button"
                onClick={handleOptimizeRoute}
                disabled={!routeStart || routeStopOrder.length < 2 || isOptimizingRoute}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                title={
                  !routeStart
                    ? "Set a starting point first"
                    : routeStopOrder.length < 2
                      ? "Need at least 2 stops"
                      : "Optimize route from your starting point"
                }
              >
                {isOptimizingRoute ? "Optomizing route…" : "Optomize Route"}
              </button>
              {routeStopOrder.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No stops yet — select customers in the list below or add an
                  address above.
                </p>
              ) : (
                <ul className="space-y-1.5 pr-0.5" onDragEnd={endRouteDrag}>
                  {routeStopOrder.map((key, index) => (
                    <li
                      key={`${key.kind}:${key.id}`}
                      className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors w-full ${
                        routeDragOverIndex === index
                          ? "bg-cyan-900/50 ring-1 ring-cyan-500/70"
                          : "bg-slate-700/70"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setRouteDragOverIndex(index);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from =
                          routeDragFromIndex.current ??
                          parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const len =
                          useCustomerStore.getState().routeStopOrder.length;
                        if (Number.isNaN(from) || from < 0 || from >= len) {
                          endRouteDrag();
                          return;
                        }
                        reorderRouteStops(from, index);
                        endRouteDrag();
                      }}
                    >
                      <span
                        draggable
                        onDragStart={(e) => {
                          routeDragFromIndex.current = index;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index));
                        }}
                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 px-0.5 select-none shrink-0 touch-none text-base leading-none"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        ⋮⋮
                      </span>
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-amber-300 tabular-nums ring-1 ring-amber-600/50"
                        title={`Map marker: ${routeVisitLetter(index)}`}
                      >
                        {routeVisitLetter(index)}
                      </span>
                      {key.kind === "manual" ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-purple-300/90 shrink-0">
                          Extra
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeStopFromRoute(key.kind, key.id)}
                        className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-200 hover:bg-red-900/80 text-xs shrink-0 ml-auto"
                        aria-label="Remove from route"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Filters */}
            <div className="p-3 sm:p-4 border-b border-slate-700 space-y-3 order-6 md:order-none shrink-0">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Search by name
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs text-slate-300 mb-1">
                  Frequency
                </label>
                <select
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="Biannual">Biannual</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="OneTime">OneTime</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Due</label>
                <select
                  value={dueOnly ? "due" : "all"}
                  onChange={(e) => setDueOnly(e.target.value === "due")}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="due">Due Only</option>
                </select>
              </div>
            </div>

            {/* Customer list: on mobile, whole panel scrolls; on md+, only this section scrolls */}
            <div className="flex-none order-7 md:order-none">
              {customersWithCoords.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  No customers with coordinates match filters.
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {customersWithCoords.map((customer) => {
                    return (
                      <div
                        key={customer.id}
                        className={`p-3 hover:bg-slate-700 cursor-pointer ${
                          selectedMarkerId === customer.id ? "bg-slate-700" : ""
                        }`}
                        onClick={() => panToCustomer(customer)}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={customer.isSelectedForRoute || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleRouteSelection(customer.id);
                            }}
                            className="mt-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-100 text-sm">
                              {customer.displayName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {customer.city}, {customer.state}
                            </div>
                            <div className="text-xs text-slate-400">
                              Next: {formatDate(customer.nextServiceDate)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {customer.serviceFrequency}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Map — top on mobile, fills right column on md+ */}
          <div className="relative order-1 md:order-2 w-full min-w-0 shrink-0 h-[min(42vh,360px)] min-h-[280px] max-h-[420px] md:max-h-none md:h-auto md:flex-1 md:min-h-0 border-b md:border-b-0 md:border-l border-slate-700">
            {routeMoveAwaitingTargetFromIndex !== null && (
              <div className="absolute left-2 right-2 top-2 z-[2] flex flex-wrap items-center justify-center gap-2 rounded-lg border border-cyan-600/60 bg-slate-950/95 px-2 py-2 text-center shadow-lg sm:left-4 sm:right-4">
                <p className="text-xs text-cyan-100">
                  Tap another route stop on the map (letter{" "}
                  <span className="font-bold text-amber-300">A</span>,{" "}
                  <span className="font-bold text-amber-300">B</span>…).{" "}
                  <span className="text-slate-400">Esc to cancel.</span>
                </p>
                <button
                  type="button"
                  onClick={() => setRouteMoveAwaitingTargetFromIndex(null)}
                  className="shrink-0 rounded border border-slate-500 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            )}
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              mapContainerClassName="block"
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={(map) => {
                mapRef.current = map;
                setIsMapLoaded(true);
                // Recalculate route after map loads if we have selected customers
                if (orderedRoutePoints.length >= 2) {
                  setTimeout(() => {
                    calculateRoute();
                  }, 500);
                }
              }}
              options={{
                // One-finger pan on touch devices (default "cooperative" needs 2 fingers so the page can scroll)
                gestureHandling: "greedy",
                styles: [
                  {
                    featureType: "all",
                    elementType: "geometry",
                    stylers: [{ color: "#242f3e" }],
                  },
                  {
                    featureType: "all",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#242f3e" }],
                  },
                  {
                    featureType: "all",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#746855" }],
                  },
                  {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [{ color: "#17263c" }],
                  },
                  {
                    featureType: "road",
                    elementType: "geometry",
                    stylers: [{ color: "#38414e" }],
                  },
                  {
                    featureType: "road",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#212a37" }],
                  },
                  {
                    featureType: "road",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#9ca5b3" }],
                  },
                  {
                    featureType: "road.highway",
                    elementType: "geometry",
                    stylers: [{ color: "#746855" }],
                  },
                  {
                    featureType: "road.highway",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#1f2835" }],
                  },
                  {
                    featureType: "road.highway",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#f3d19c" }],
                  },
                  {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [{ color: "#2f3948" }],
                  },
                  {
                    featureType: "transit.station",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#d59563" }],
                  },
                  {
                    featureType: "poi",
                    elementType: "geometry",
                    stylers: [{ color: "#283036" }],
                  },
                  {
                    featureType: "poi.park",
                    elementType: "geometry",
                    stylers: [{ color: "#263c3f" }],
                  },
                  {
                    featureType: "poi.park",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#6b9a76" }],
                  },
                  {
                    featureType: "poi",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#d59563" }],
                  },
                  {
                    featureType: "poi",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#1a1a1a" }],
                  },
                ],
              }}
            >
              {/* Markers */}
              {customersWithCoords.map((customer) => {
                const color = getMarkerColor(customer);
                const letter = routeStopLetterByKey.get(`customer:${customer.id}`);
                const icon = markerIconForColorAndLabel(color, letter);
                const pos = {
                  lat: customer.latitude!,
                  lng: customer.longitude!,
                };
                return (
                    <Marker
                      key={`${customer.id}-${customer.isSelectedForRoute ? "sel" : "un"}-${color}-${letter ?? "x"}`}
                      position={pos}
                      icon={icon}
                      onClick={() =>
                        onRouteStopMarkerClick(
                          `customer:${customer.id}`,
                          customer.id
                        )
                      }
                    >
                      {selectedMarkerId === customer.id && (
                        <InfoWindow
                          onCloseClick={() => setSelectedMarkerId(null)}
                          position={pos}
                        >
                          <div className="text-slate-900">
                            {letter ? (
                              <div className="text-xs font-bold text-amber-800 mb-1">
                                Route stop {letter}
                              </div>
                            ) : null}
                            <div className="font-semibold mb-2">
                              {customer.displayName}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                toggleRouteSelection(customer.id);
                                setSelectedMarkerId(null);
                              }}
                              className={`text-xs px-3 py-1.5 rounded w-full sm:w-auto mb-3 ${
                                customer.isSelectedForRoute
                                  ? "bg-red-600 text-white"
                                  : "bg-blue-600 text-white"
                              }`}
                            >
                              {customer.isSelectedForRoute
                                ? "Remove from Route"
                                : "Add to Route"}
                            </button>
                            <div className="text-sm mb-1">
                              {customer.city}, {customer.state}
                            </div>
                            <div className="text-sm mb-1">
                              Last: {formatDate(customer.lastServiceDate)}
                            </div>
                            <div className="text-sm mb-1">
                              Next: {formatDate(customer.nextServiceDate)}
                            </div>
                            <div className="text-sm">
                              {customer.serviceFrequency}
                            </div>
                            {letter ? (
                              <RouteMoveInMapInfo
                                fromIndex={
                                  routeStopIndexByKey.get(
                                    `customer:${customer.id}`
                                  )!
                                }
                              />
                            ) : null}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                );
              })}

              {/* Starting point */}
              {routeStart && (
                  <Marker
                    key={routeStart.id}
                    position={{ lat: routeStart.lat, lng: routeStart.lng }}
                    icon={markerIconForColorAndLabel("#06b6d4", "S")}
                    onClick={() => {
                      setRouteMoveAwaitingTargetFromIndex(null);
                      setSelectedMarkerId(START_MARKER_ID);
                    }}
                    title={routeStart.label}
                  >
                    {selectedMarkerId === START_MARKER_ID && (
                      <InfoWindow
                        onCloseClick={() => setSelectedMarkerId(null)}
                        position={{
                          lat: routeStart.lat,
                          lng: routeStart.lng,
                        }}
                      >
                        <div className="text-slate-900 max-w-[220px]">
                          <div className="text-xs font-bold text-cyan-800 mb-1">
                            Map pin: S — starting point
                          </div>
                          <div className="font-semibold text-cyan-800 mb-1">
                            {routeStart.label}
                          </div>
                          <div className="text-xs mb-2">{routeStart.address}</div>
                          <button
                            type="button"
                            onClick={() => {
                              clearRouteStart();
                              setSelectedMarkerId(null);
                            }}
                            className="text-xs bg-slate-700 text-white px-2 py-1 rounded w-full"
                          >
                            Clear starting point
                          </button>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
              )}

              {/* Manual / extra route stops */}
              {manualStops.map((stop) => {
                const letter = routeStopLetterByKey.get(`manual:${stop.id}`);
                const icon = markerIconForColorAndLabel("#a855f7", letter);
                const pos = { lat: stop.lat, lng: stop.lng };
                return (
                    <Marker
                      key={`${stop.id}-${letter ?? "x"}`}
                      position={pos}
                      icon={icon}
                      onClick={() =>
                        onRouteStopMarkerClick(`manual:${stop.id}`, stop.id)
                      }
                      title={stop.label}
                    >
                      {selectedMarkerId === stop.id && (
                        <InfoWindow
                          onCloseClick={() => setSelectedMarkerId(null)}
                          position={pos}
                        >
                          <div className="text-slate-900 max-w-[220px]">
                            {letter ? (
                              <div className="text-xs font-bold text-amber-800 mb-1">
                                Route stop {letter}
                              </div>
                            ) : null}
                            <div className="font-semibold mb-1">{stop.label}</div>
                            <div className="text-xs mb-2">{stop.address}</div>
                            <button
                              type="button"
                              onClick={() => {
                                removeManualStop(stop.id);
                                setSelectedMarkerId(null);
                              }}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                            >
                              Remove from route
                            </button>
                            {letter ? (
                              <RouteMoveInMapInfo
                                fromIndex={
                                  routeStopIndexByKey.get(`manual:${stop.id}`)!
                                }
                              />
                            ) : null}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                );
              })}

              {/* Preview before adding to route */}
              {addressPreview && (
                <Marker
                  key={PREVIEW_MARKER_ID}
                  position={{
                    lat: addressPreview.lat,
                    lng: addressPreview.lng,
                  }}
                  icon={createMarkerIcon("#fbbf24")}
                  onClick={() => {
                    setRouteMoveAwaitingTargetFromIndex(null);
                    setSelectedMarkerId(PREVIEW_MARKER_ID);
                  }}
                >
                  {selectedMarkerId === PREVIEW_MARKER_ID && (
                    <InfoWindow
                      onCloseClick={() => setSelectedMarkerId(null)}
                      position={{
                        lat: addressPreview.lat,
                        lng: addressPreview.lng,
                      }}
                    >
                      <div className="text-slate-900 max-w-[220px]">
                        <div className="font-semibold text-xs mb-1">Preview</div>
                        <div className="text-xs mb-2">{addressPreview.address}</div>
                        <button
                          type="button"
                          onClick={handleAddPreviewToRoute}
                          className="text-xs bg-amber-600 text-white px-2 py-1 rounded w-full"
                        >
                          Add to route
                        </button>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              )}

              {/* Route line only — our Markers are the pins (DirectionsRenderer defaults add red A/B/C pins). */}
              {directionsResult && (
                <DirectionsRenderer
                  directions={directionsResult}
                  options={{ suppressMarkers: true }}
                />
              )}
            </GoogleMap>
          </div>
        </div>
      </div>
    </MapLoader>
  );
}

