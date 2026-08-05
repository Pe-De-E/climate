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

  const yearsAgo = Number(req.query.yearsAgo ?? DEFAULT_YEARS_AGO);
  if (!Number.isInteger(yearsAgo) || yearsAgo < 1) {
    res.status(400).json({ error: "yearsAgo must be a positive integer" });
    return;
  }

  const recentYear = new Date().getUTCFullYear() - 1;
  const pastYear = recentYear - yearsAgo;
  if (pastYear < ARCHIVE_START_YEAR) {
    res.status(400).json({
      error: `yearsAgo is out of range: the archive only covers years from ${ARCHIVE_START_YEAR} onward`,
    });
    return;
  }

  const { latGrid, lngGrid } = snapToGrid(lat, lng);

  const [recentResult, pastResult] = await Promise.allSettled([
    getOrFetchYear(latGrid, lngGrid, recentYear),
    getOrFetchYear(latGrid, lngGrid, pastYear),
  ]);

  const failedYears = [
    recentResult.status === "rejected" ? recentYear : null,
    pastResult.status === "rejected" ? pastYear : null,
  ].filter((year): year is number => year !== null);

  if (failedYears.length > 0) {
    res.status(502).json({
      error: `failed to fetch historical weather data for year(s): ${failedYears.join(", ")}`,
    });
    return;
  }

  const recent = (recentResult as PromiseFulfilledResult<Awaited<ReturnType<typeof getOrFetchYear>>>).value;
  const past = (pastResult as PromiseFulfilledResult<Awaited<ReturnType<typeof getOrFetchYear>>>).value;

  res.json({
    coordinates: { lat, lng, latGrid, lngGrid },
    unit: recent.unit,
    recentYear,
    pastYear,
    recent: { year: recentYear, monthlyMeans: recent.monthlyMeans },
    past: { year: pastYear, monthlyMeans: past.monthlyMeans },
  });
});
