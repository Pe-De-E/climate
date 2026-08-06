import { Router } from "express";
import { getOrFetchYear } from "../services/monthlyClimateCache.js";

export const weatherRouter: Router = Router();

const DEFAULT_YEARS_AGO = 40;
const ARCHIVE_START_YEAR = 1940;

const snapToGrid = (lat: number, lng: number) => ({
  latGrid: Math.round(lat * 10) / 10,
  lngGrid: Math.round(lng * 10) / 10,
});

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
  const year1 = Number(req.query.year1 ?? lastFullYear - DEFAULT_YEARS_AGO);
  const year2 = Number(req.query.year2 ?? lastFullYear);

  for (const [name, year] of [
    ["year1", year1],
    ["year2", year2],
  ] as const) {
    if (!Number.isInteger(year) || year < ARCHIVE_START_YEAR || year > lastFullYear) {
      res.status(400).json({
        error: `${name} must be an integer between ${ARCHIVE_START_YEAR} and ${lastFullYear}`,
      });
      return;
    }
  }

  if (year1 === year2) {
    res.status(400).json({ error: "year1 and year2 must be different" });
    return;
  }

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
