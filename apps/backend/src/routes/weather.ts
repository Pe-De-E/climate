import { Router, type Request } from "express";
import { getOrFetchYear } from "../services/monthlyClimateCache.js";
import { buildAnomalyGrid, buildGridPoints } from "../services/globalGrid.js";
import { MonthlyClimate } from "../models/MonthlyClimate.js";
import {
  getOrFetchExtremeDayCounts,
  getBaselineAverage,
} from "../services/extremeDaysCache.js";
import {
  HOT_DAY_MAX_C,
  FROST_DAY_MIN_C,
  HEAVY_RAIN_MM,
  STORM_GUST_KMH,
  BASELINE_START_YEAR,
  BASELINE_END_YEAR,
} from "../services/extremeThresholds.js";

export const weatherRouter: Router = Router();

const DEFAULT_YEARS_AGO = 40;
const ARCHIVE_START_YEAR = 1940;
const ALLOWED_RESOLUTIONS = [2, 5, 10];
const DEFAULT_RESOLUTION = 2;
const MAX_GRID_POINTS = 20000;

const snapToGrid = (lat: number, lng: number) => ({
  latGrid: Math.round(lat * 10) / 10,
  lngGrid: Math.round(lng * 10) / 10,
});

function parseYearPair(
  req: Request,
  lastFullYear: number,
): { year1: number; year2: number } | { error: string } {
  const year1 = Number(req.query.year1 ?? lastFullYear - DEFAULT_YEARS_AGO);
  const year2 = Number(req.query.year2 ?? lastFullYear);

  for (const [name, year] of [
    ["year1", year1],
    ["year2", year2],
  ] as const) {
    if (!Number.isInteger(year) || year < ARCHIVE_START_YEAR || year > lastFullYear) {
      return {
        error: `${name} must be an integer between ${ARCHIVE_START_YEAR} and ${lastFullYear}`,
      };
    }
  }

  if (year1 === year2) {
    return { error: "year1 and year2 must be different" };
  }

  return { year1, year2 };
}

function parseSingleYear(
  req: Request,
  lastFullYear: number,
): { year: number } | { error: string } {
  const year = Number(req.query.year ?? lastFullYear);
  if (!Number.isInteger(year) || year < ARCHIVE_START_YEAR || year > lastFullYear) {
    return {
      error: `year must be an integer between ${ARCHIVE_START_YEAR} and ${lastFullYear}`,
    };
  }
  return { year };
}

weatherRouter.get("/current", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params must be numbers" });
    return;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`;
  const upstream = await fetch(url);

  if (!upstream.ok) {
    res.status(502).json({ error: "failed to fetch weather data" });
    return;
  }

  const data = await upstream.json();
  res.json({
    temperature: data.current.temperature_2m,
    unit: data.current_units.temperature_2m,
    time: data.current.time,
  });
});

weatherRouter.get("/history", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params must be numbers" });
    return;
  }

  const lastFullYear = new Date().getUTCFullYear() - 1;
  const yearPair = parseYearPair(req, lastFullYear);
  if ("error" in yearPair) {
    res.status(400).json({ error: yearPair.error });
    return;
  }
  const { year1, year2 } = yearPair;

  const { latGrid, lngGrid } = snapToGrid(lat, lng);

  const [result1, result2] = await Promise.allSettled([
    getOrFetchYear(latGrid, lngGrid, year1),
    getOrFetchYear(latGrid, lngGrid, year2),
  ]);

  const failedYears = [
    result1.status === "rejected" ? year1 : null,
    result2.status === "rejected" ? year2 : null,
  ].filter((year): year is number => year !== null);

  if (failedYears.length > 0) {
    res.status(502).json({
      error: `failed to fetch historical weather data for year(s): ${failedYears.join(", ")}`,
    });
    return;
  }

  const data1 = (
    result1 as PromiseFulfilledResult<Awaited<ReturnType<typeof getOrFetchYear>>>
  ).value;
  const data2 = (
    result2 as PromiseFulfilledResult<Awaited<ReturnType<typeof getOrFetchYear>>>
  ).value;

  res.json({
    coordinates: { lat, lng, latGrid, lngGrid },
    unit: data1.unit,
    years: [
      { year: year1, monthlyMeans: data1.monthlyMeans },
      { year: year2, monthlyMeans: data2.monthlyMeans },
    ],
  });
});

weatherRouter.get("/global", async (req, res) => {
  const lastFullYear = new Date().getUTCFullYear() - 1;
  const yearPair = parseYearPair(req, lastFullYear);
  if ("error" in yearPair) {
    res.status(400).json({ error: yearPair.error });
    return;
  }
  const { year1, year2 } = yearPair;

  const resolution = Number(req.query.resolution ?? DEFAULT_RESOLUTION);
  if (!ALLOWED_RESOLUTIONS.includes(resolution)) {
    res.status(400).json({
      error: `resolution must be one of: ${ALLOWED_RESOLUTIONS.join(", ")}`,
    });
    return;
  }

  // defensive guard; unreachable via the resolution allow-list above unless
  // it's edited carelessly later
  if (buildGridPoints(resolution).length > MAX_GRID_POINTS) {
    res.status(400).json({ error: "grid too large" });
    return;
  }

  const { cells, unit, requested, failed } = await buildAnomalyGrid(
    resolution,
    year1,
    year2,
  );

  if (failed > requested * 0.5) {
    res.status(502).json({
      error: "failed to fetch historical weather data for most of the grid",
    });
    return;
  }

  res.json({
    resolution,
    unit,
    years: [year1, year2],
    cells,
    meta: { requested, returned: cells.length, failed },
  });
});

// Lightweight polling endpoint for the frontend to show real progress while
// a /global request is in flight — counts how many of the current grid's
// cache entries already exist, without recomputing anything itself.
weatherRouter.get("/global/progress", async (req, res) => {
  const lastFullYear = new Date().getUTCFullYear() - 1;
  const yearPair = parseYearPair(req, lastFullYear);
  if ("error" in yearPair) {
    res.status(400).json({ error: yearPair.error });
    return;
  }
  const { year1, year2 } = yearPair;

  const resolution = Number(req.query.resolution ?? DEFAULT_RESOLUTION);
  if (!ALLOWED_RESOLUTIONS.includes(resolution)) {
    res.status(400).json({
      error: `resolution must be one of: ${ALLOWED_RESOLUTIONS.join(", ")}`,
    });
    return;
  }

  const total = buildGridPoints(resolution).length * 2;
  const done = await MonthlyClimate.countDocuments({
    year: { $in: [year1, year2] },
    latGrid: { $gte: -80, $lte: 80, $mod: [resolution, 0] },
    lngGrid: { $gte: -180, $lt: 180, $mod: [resolution, 0] },
  });

  res.json({ done, total });
});

// Counts of fixed-threshold "extreme days" (hot/frost/heavy-rain/storm) for
// a single year at a point, plus the same count averaged over the frozen
// 1961-1990 baseline period at that same point. Comparing a location to its
// own baseline sidesteps needing a climate-zone dataset, and the fixed
// baseline period keeps the comparison meaningful as the climate warms.
weatherRouter.get("/extremes", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params must be numbers" });
    return;
  }

  const lastFullYear = new Date().getUTCFullYear() - 1;
  const parsedYear = parseSingleYear(req, lastFullYear);
  if ("error" in parsedYear) {
    res.status(400).json({ error: parsedYear.error });
    return;
  }
  const { year } = parsedYear;

  const { latGrid, lngGrid } = snapToGrid(lat, lng);

  try {
    const [counts, baseline] = await Promise.all([
      getOrFetchExtremeDayCounts(latGrid, lngGrid, year),
      getBaselineAverage(latGrid, lngGrid),
    ]);

    res.json({
      coordinates: { lat, lng, latGrid, lngGrid },
      year,
      counts,
      baseline: {
        period: `${BASELINE_START_YEAR}–${BASELINE_END_YEAR}`,
        counts: baseline,
      },
      thresholds: {
        hotDayMaxC: HOT_DAY_MAX_C,
        frostDayMinC: FROST_DAY_MIN_C,
        heavyRainMm: HEAVY_RAIN_MM,
        stormGustKmh: STORM_GUST_KMH,
      },
    });
  } catch (error) {
    console.error("extremes fetch failed:", error);
    res.status(502).json({ error: "failed to fetch extreme weather data" });
  }
});
