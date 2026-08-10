import { ExtremeDayCounts } from "../models/ExtremeDayCounts.js";
import {
  fetchDailyExtremeVariables,
  countExtremeDays,
  type ExtremeDayCountsResult,
} from "./openMeteoArchive.js";
import { mapWithConcurrency } from "./concurrency.js";
import { BASELINE_START_YEAR, BASELINE_END_YEAR } from "./extremeThresholds.js";

// Same throttling behavior as the global grid's archive calls (see
// globalGrid.ts) — Open-Meteo's free tier throttles bursts above ~8
// concurrent connections.
const CONCURRENCY_LIMIT = 4;

export async function getOrFetchExtremeDayCounts(
  latGrid: number,
  lngGrid: number,
  year: number,
): Promise<ExtremeDayCountsResult> {
  // The current calendar year is still in progress — its count grows every
  // day, so it must never be written to (or served from) the permanent
  // cache. Every other year is finished and safe to cache forever.
  const isInProgressYear = year === new Date().getUTCFullYear();

  if (!isInProgressYear) {
    const cached = await ExtremeDayCounts.findOne({ latGrid, lngGrid, year });
    if (cached) {
      return {
        hotDays: cached.hotDays,
        frostDays: cached.frostDays,
        heavyRainDays: cached.heavyRainDays,
        stormDays: cached.stormDays,
        daysWithData: cached.daysWithData,
      };
    }
  }

  const variables = await fetchDailyExtremeVariables(latGrid, lngGrid, year);
  const counts = countExtremeDays(variables);

  if (!isInProgressYear) {
    // upsert instead of create: two concurrent first-time requests for the
    // same brand-new grid cell/year would otherwise both try to insert and
    // collide on the unique index.
    await ExtremeDayCounts.findOneAndUpdate(
      { latGrid, lngGrid, year },
      { $setOnInsert: { ...counts, source: "open-meteo-archive" } },
      { upsert: true, new: true },
    );
  }

  return counts;
}

export interface BaselineAverage {
  hotDays: number;
  frostDays: number;
  heavyRainDays: number;
  stormDays: number;
  yearsUsed: number;
}

// No separate baseline collection: the 30 individual years are already
// cached via getOrFetchExtremeDayCounts (ExtremeDayCounts), so averaging
// them on each call is just cheap Mongo reads once a location is warm.
export async function getBaselineAverage(
  latGrid: number,
  lngGrid: number,
): Promise<BaselineAverage> {
  const years = Array.from(
    { length: BASELINE_END_YEAR - BASELINE_START_YEAR + 1 },
    (_, i) => BASELINE_START_YEAR + i,
  );

  const settled = await mapWithConcurrency(years, CONCURRENCY_LIMIT, (year) =>
    getOrFetchExtremeDayCounts(latGrid, lngGrid, year),
  );

  const fulfilled = settled.filter(
    (r): r is PromiseFulfilledResult<ExtremeDayCountsResult> =>
      r.status === "fulfilled",
  );

  if (fulfilled.length === 0) {
    throw new Error("failed to compute baseline: no baseline years available");
  }

  const sum = (pick: (c: ExtremeDayCountsResult) => number) =>
    fulfilled.reduce((acc, r) => acc + pick(r.value), 0);

  return {
    hotDays: Math.round((sum((c) => c.hotDays) / fulfilled.length) * 10) / 10,
    frostDays: Math.round((sum((c) => c.frostDays) / fulfilled.length) * 10) / 10,
    heavyRainDays:
      Math.round((sum((c) => c.heavyRainDays) / fulfilled.length) * 10) / 10,
    stormDays: Math.round((sum((c) => c.stormDays) / fulfilled.length) * 10) / 10,
    yearsUsed: fulfilled.length,
  };
}
