export type GeocodeResult = { lat: number; lng: number };

/**
 * Geocode an address (Google Geocoding HTTP API).
 * Swap providers later by replacing this module or delegating to another
 * function with the same signature.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("Google Maps API key not configured");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    } else {
      console.warn(`Geocoding failed for ${address}:`, data.status);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error);
    return null;
  }
}

/**
 * Check if a customer has valid coordinates
 */
export function hasCoordinates(
  customer: { latitude?: number | null; longitude?: number | null }
): boolean {
  return (
    customer.latitude !== undefined &&
    customer.latitude !== null &&
    customer.longitude !== undefined &&
    customer.longitude !== null
  );
}

