import { getOrFetchYear } from "./monthlyClimateCache.js";
import { mapWithConcurrency } from "./concurrency.js";
import { ArchiveRateLimitError } from "./openMeteoArchive.js";
import { GlobalAnomalyGrid } from "../models/GlobalAnomalyGrid.js";

// Open-Meteo's free archive API throttles bursts well below 8 concurrent
// connections (observed 429s at that level even with retries) — 4 stays
// under that threshold while still parallelizing meaningfully.
const CONCURRENCY_LIMIT = 4;
// Web Mercator's usable latitude range tops out around ±85.05°; staying
// inside ±80 keeps every grid cell renderable without edge distortion.
const LAT_LIMIT = 80;

export interface GridPoint {
  lat: number;
  lng: number;
}

export function buildGridPoints(resolutionDeg: number): GridPoint[] {
  const latMax = Math.floor(LAT_LIMIT / resolutionDeg) * resolutionDeg;
  const points: GridPoint[] = [];
  for (let lat = -latMax; lat <= latMax; lat += resolutionDeg) {
    for (let lng = -180; lng < 180; lng += resolutionDeg) {
      points.push({ lat, lng });
    }
  }
  return points;
}

export function annualMean(monthlyMeans: (number | null)[]) {
  const valid = monthlyMeans.filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export interface AnomalyCell {
  lat: number;
  lng: number;
  delta: number;
}

export async function buildAnomalyGrid(
  resolutionDeg: number,
  year1: number,
  year2: number,
) {
  const points = buildGridPoints(resolutionDeg);
  const tasks = points.flatMap((point) => [
    { point, year: year1 },
    { point, year: year2 },
  ]);

  const settled = await mapWithConcurrency(tasks, CONCURRENCY_LIMIT, (t) =>
    getOrFetchYear(t.point.lat, t.point.lng, t.year),
  );

  const cells: AnomalyCell[] = [];
  let unit = "°C";
  let failed = 0;
  const rateLimited = settled.some(
    (r) => r.status === "rejected" && r.reason instanceof ArchiveRateLimitError,
  );

  points.forEach((point, i) => {
    const r1 = settled[i * 2]!;
    const r2 = settled[i * 2 + 1]!;
    if (r1.status !== "fulfilled" || r2.status !== "fulfilled") {
      failed++;
      return;
    }
    unit = r1.value.unit;
    const mean1 = annualMean(r1.value.monthlyMeans);
    const mean2 = annualMean(r2.value.monthlyMeans);
    if (mean1 === null || mean2 === null) {
      failed++;
      return;
    }
    cells.push({
      lat: point.lat,
      lng: point.lng,
      delta: Math.round((mean2 - mean1) * 10) / 10,
    });
  });

  return { cells, unit, requested: points.length, failed, rateLimited };
}

// The global view has no year picker, so resolution/year1/year2 only ever
// take on a handful of values in practice — the finished grid (not just the
// per-cell monthly climate it's built from) is worth persisting so repeat
// requests skip the ~14k-cell rebuild entirely instead of just hitting a
// warm MonthlyClimate cache.
export async function getOrBuildAnomalyGrid(
  resolutionDeg: number,
  year1: number,
  year2: number,
) {
  const cached = await GlobalAnomalyGrid.findOne({
    resolution: resolutionDeg,
    year1,
    year2,
  });
  if (cached) {
    return {
      cells: cached.cells,
      unit: cached.unit,
      requested: cached.cells.length,
      failed: 0,
      rateLimited: false,
    };
  }

  const result = await buildAnomalyGrid(resolutionDeg, year1, year2);

  // Same 50% failure ratio the route itself uses to decide whether a live
  // result is good enough to serve — a cached grid can never be worse than
  // what a live request would already have accepted.
  if (result.failed <= result.requested * 0.5) {
    await GlobalAnomalyGrid.findOneAndUpdate(
      { resolution: resolutionDeg, year1, year2 },
      {
        $setOnInsert: {
          cells: result.cells,
          unit: result.unit,
          source: "open-meteo-archive",
        },
      },
      { upsert: true, new: true },
    );
  }

  return result;
}
