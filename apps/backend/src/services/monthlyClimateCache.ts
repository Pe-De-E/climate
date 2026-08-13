import { MonthlyClimate } from "../models/MonthlyClimate.js";
import { fetchDailyMeans, aggregateToMonthly } from "./openMeteoArchive.js";

export function cacheKey(latGrid: number, lngGrid: number, year: number) {
  return `${latGrid},${lngGrid},${year}`;
}

// Bulk variant of getOrFetchYear's cache check, for callers like the global
// grid that need thousands of (point, year) combinations at once — a
// findOne per combination means thousands of sequential Mongo round trips
// even when every one of them is already cached, which dominates the whole
// request's latency on a warm cache. lat/lng $in works here because callers
// only ever pass the full Cartesian product of their lat/lng sets (a
// rectangular grid), so every (latGrid, lngGrid) combination matched is
// guaranteed to be one the caller actually asked for.
export async function getCachedYears(
  points: { lat: number; lng: number }[],
  years: number[],
): Promise<Map<string, { monthlyMeans: (number | null)[]; unit: string }>> {
  const latGrids = [...new Set(points.map((p) => p.lat))];
  const lngGrids = [...new Set(points.map((p) => p.lng))];

  const docs = await MonthlyClimate.find({
    year: { $in: years },
    latGrid: { $in: latGrids },
    lngGrid: { $in: lngGrids },
  }).lean();

  const map = new Map<string, { monthlyMeans: (number | null)[]; unit: string }>();
  docs.forEach((doc) => {
    map.set(cacheKey(doc.latGrid, doc.lngGrid, doc.year), {
      monthlyMeans: doc.monthlyMeans,
      unit: doc.unit,
    });
  });
  return map;
}

export async function getOrFetchYear(
  latGrid: number,
  lngGrid: number,
  year: number,
) {
  const cached = await MonthlyClimate.findOne({ latGrid, lngGrid, year });
  if (cached) {
    return { monthlyMeans: cached.monthlyMeans, unit: cached.unit };
  }

  const { dates, values, unit } = await fetchDailyMeans(
    latGrid,
    lngGrid,
    year,
  );
  const { monthlyMeans, daysWithData } = aggregateToMonthly(dates, values);

  // upsert instead of create: two concurrent first-time requests for the same
  // brand-new grid cell/year would otherwise both try to insert and collide
  // on the unique index.
  await MonthlyClimate.findOneAndUpdate(
    { latGrid, lngGrid, year },
    { $setOnInsert: { monthlyMeans, daysWithData, unit, source: "open-meteo-archive" } },
    { upsert: true, new: true },
  );

  return { monthlyMeans, unit };
}
