/**
 * Helpers for drive time / mileage from Google Directions legs.
 * Distances are meters; durations are seconds.
 */

export type RouteLegStat = {
  durationSec: number;
  distanceMeters: number;
  durationText: string;
  distanceText: string;
};

export type RouteDriveStats = {
  legs: RouteLegStat[];
  totalDurationSec: number;
  totalDistanceMeters: number;
  totalDurationText: string;
  totalDistanceText: string;
};

const METERS_PER_MILE = 1609.344;

export function formatDriveDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 1) return "<1 min";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatDriveMiles(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return "<0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Pull per-leg and totals from a Google Directions result.
 * Returns null when there are no usable legs.
 */
export function extractRouteDriveStats(
  directionsResult: any | null | undefined
): RouteDriveStats | null {
  const legs = directionsResult?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) return null;

  const parsed: RouteLegStat[] = [];
  let totalDurationSec = 0;
  let totalDistanceMeters = 0;

  for (const leg of legs) {
    const durationSec = Number(leg?.duration?.value) || 0;
    const distanceMeters = Number(leg?.distance?.value) || 0;
    totalDurationSec += durationSec;
    totalDistanceMeters += distanceMeters;
    parsed.push({
      durationSec,
      distanceMeters,
      durationText: formatDriveDuration(durationSec),
      distanceText: formatDriveMiles(distanceMeters),
    });
  }

  return {
    legs: parsed,
    totalDurationSec,
    totalDistanceMeters,
    totalDurationText: formatDriveDuration(totalDurationSec),
    totalDistanceText: formatDriveMiles(totalDistanceMeters),
  };
}
