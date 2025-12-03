"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCustomerStore } from "@/store/customer-store";
import { Customer, ServiceFrequency } from "@/types/customer";
import { formatDate, isCustomerDue } from "@/lib/utils";
import { geocodeAddress, hasCoordinates } from "@/lib/geocoding";
import MapLoader from "@/components/map/MapLoader";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { parse } from "date-fns";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

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

export default function MapPage() {
  const { customers, updateCustomer } = useCustomerStore();
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
  const [isMapLoaded, setIsMapLoaded] = useState(false);

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

  // Calculate route with Directions API
  const calculateRoute = useCallback(() => {
    if (selectedForRoute.length < 2) {
      setDirectionsResult(null);
      setDirectionsError(null);
      return;
    }

    if (typeof window === "undefined" || !(window as any).google?.maps) {
      setDirectionsError("Google Maps API not loaded");
      return;
    }

    const google = (window as any).google;

    // Check if DirectionsService is available
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

    const waypoints = selectedForRoute
      .slice(1, -1)
      .map((c) => ({
        location: { lat: c.latitude!, lng: c.longitude! },
        stopover: true,
      }));

    const request: any = {
      origin: {
        lat: selectedForRoute[0].latitude!,
        lng: selectedForRoute[0].longitude!,
      },
      destination: {
        lat: selectedForRoute[selectedForRoute.length - 1].latitude!,
        lng: selectedForRoute[selectedForRoute.length - 1].longitude!,
      },
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      optimizeWaypoints: true,
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
  }, [selectedForRoute]);

  // Recalculate route when selection changes (only after map is loaded)
  useEffect(() => {
    // Only calculate route if map is loaded and we have at least 2 stops
    if (selectedForRoute.length >= 2 && mapRef.current) {
      // Small delay to ensure Google Maps API is fully ready
      const timer = setTimeout(() => {
        calculateRoute();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDirectionsResult(null);
      setDirectionsError(null);
    }
  }, [selectedForRoute.length, calculateRoute]);

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

  return (
    <MapLoader>
      <div className="h-screen flex flex-col bg-slate-900">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
          <h1 className="text-2xl font-bold text-slate-100">Map View</h1>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar */}
          <div className="w-full md:w-80 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
            {/* Geocode Management */}
            <div className="p-4 border-b border-slate-700">
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

            {/* Summary */}
            <div className="p-4 border-b border-slate-700">
              <div className="text-sm text-slate-300">
                <div>Visible customers: {customersWithCoords.length}</div>
                <div>Selected for route: {selectedForRoute.length}</div>
              </div>
              {directionsError && (
                <div className="mt-2 text-xs text-red-400">{directionsError}</div>
              )}
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-700 space-y-3">
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

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto">
              {customersWithCoords.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  No customers with coordinates match filters.
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {customersWithCoords.map((customer) => {
                    const isDue = isCustomerDue(customer);
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

          {/* Map */}
          <div className="flex-1 relative">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={defaultZoom}
              onLoad={(map) => {
                mapRef.current = map;
                setIsMapLoaded(true);
                // Recalculate route after map loads if we have selected customers
                if (selectedForRoute.length >= 2) {
                  setTimeout(() => {
                    calculateRoute();
                  }, 500);
                }
              }}
              options={{
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
                // Always create icon fresh to ensure it updates
                const icon = createMarkerIcon(color);
                return (
                  <Marker
                    key={`${customer.id}-${customer.isSelectedForRoute ? 'selected' : 'unselected'}-${color}`}
                    position={{
                      lat: customer.latitude!,
                      lng: customer.longitude!,
                    }}
                    icon={icon}
                    onClick={() => setSelectedMarkerId(customer.id)}
                  >
                    {selectedMarkerId === customer.id && (
                      <InfoWindow
                        onCloseClick={() => setSelectedMarkerId(null)}
                        position={{
                          lat: customer.latitude!,
                          lng: customer.longitude!,
                        }}
                      >
                        <div className="text-slate-900">
                          <div className="font-semibold mb-2">
                            {customer.displayName}
                          </div>
                          <div className="text-sm mb-1">
                            {customer.city}, {customer.state}
                          </div>
                          <div className="text-sm mb-1">
                            Last: {formatDate(customer.lastServiceDate)}
                          </div>
                          <div className="text-sm mb-1">
                            Next: {formatDate(customer.nextServiceDate)}
                          </div>
                          <div className="text-sm mb-2">
                            {customer.serviceFrequency}
                          </div>
                          <button
                            onClick={() => {
                              toggleRouteSelection(customer.id);
                              setSelectedMarkerId(null);
                            }}
                            className={`text-xs px-3 py-1 rounded ${
                              customer.isSelectedForRoute
                                ? "bg-red-600 text-white"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {customer.isSelectedForRoute
                              ? "Remove from Route"
                              : "Add to Route"}
                          </button>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                );
              })}

              {/* Directions Route */}
              {directionsResult && (
                <DirectionsRenderer directions={directionsResult} />
              )}
            </GoogleMap>
          </div>
        </div>
      </div>
    </MapLoader>
  );
}

