"use client";

import { useState, useEffect, useMemo } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Customer } from "@/types/customer";

interface RouteMapProps {
  customers: Customer[];
}

interface MarkerData {
  id: string;
  position: { lat: number; lng: number };
  label: string;
  title: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

export default function RouteMap({ customers }: RouteMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  // Calculate center based on markers (must be called before any early returns)
  const center = useMemo(() => {
    if (markers.length === 0) return defaultCenter;
    return {
      lat: markers.reduce((sum, m) => sum + m.position.lat, 0) / markers.length,
      lng: markers.reduce((sum, m) => sum + m.position.lng, 0) / markers.length,
    };
  }, [markers]);

  // Geocode addresses using Google Geocoding API
  useEffect(() => {
    if (!apiKey || customers.length === 0) {
      setMarkers([]);
      return;
    }

    const geocodeAddresses = async () => {
      setIsGeocoding(true);
      setGeocodingError(null);

      try {
        const geocodePromises = customers.map(async (customer, index) => {
          const address = customer.fullAddress;
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

          try {
            const response = await fetch(geocodeUrl);
            const data = await response.json();

            if (data.status === "OK" && data.results.length > 0) {
              const location = data.results[0].geometry.location;
              return {
                id: customer.id,
                position: {
                  lat: location.lat,
                  lng: location.lng,
                },
                label: (index + 1).toString(),
                title: customer.displayName,
              };
            } else {
              console.warn(`Geocoding failed for ${address}:`, data.status);
              return null;
            }
          } catch (error) {
            console.error(`Error geocoding ${address}:`, error);
            return null;
          }
        });

        // Add a small delay between requests to avoid rate limiting
        const results = await Promise.all(
          geocodePromises.map((promise, index) =>
            new Promise((resolve) => {
              setTimeout(() => resolve(promise), index * 100);
            })
          )
        );

        const validMarkers = results.filter(
          (marker): marker is MarkerData => marker !== null
        );
        setMarkers(validMarkers);
      } catch (error) {
        console.error("Error geocoding addresses:", error);
        setGeocodingError("Failed to geocode addresses. Please check your API key and try again.");
      } finally {
        setIsGeocoding(false);
      }
    };

    geocodeAddresses();
  }, [customers, apiKey]);

  if (!apiKey) {
    return (
      <div className="bg-slate-700 rounded p-8 text-center">
        <p className="text-slate-400 mb-2">
          Google Maps API key not configured.
        </p>
        <p className="text-slate-500 text-sm">
          Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file.
        </p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-slate-700 rounded p-8 text-center">
        <p className="text-slate-400">No customers selected for route.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <LoadScript googleMapsApiKey={apiKey} loadingElement={<div className="bg-slate-700 rounded p-8 text-center"><p className="text-slate-400">Loading map...</p></div>}>
        {isGeocoding && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white px-4 py-2 rounded z-10 shadow-lg">
            Geocoding addresses...
          </div>
        )}
        {geocodingError && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-4 py-2 rounded z-10 shadow-lg">
            {geocodingError}
          </div>
        )}
        <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={markers.length > 0 ? 12 : 10}
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
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            label={marker.label}
            title={marker.title}
          />
        ))}
      </GoogleMap>
      </LoadScript>
    </div>
  );
}

