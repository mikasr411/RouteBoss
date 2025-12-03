"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { ReactNode } from "react";

interface MapLoaderProps {
  children: ReactNode;
}

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export default function MapLoader({ children }: MapLoaderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  if (loadError) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <p className="text-red-400 mb-2">Error loading Google Maps</p>
        <p className="text-slate-400 text-sm">
          Please check your API key configuration.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <p className="text-slate-400">Loading Google Maps...</p>
      </div>
    );
  }

  return <>{children}</>;
}

