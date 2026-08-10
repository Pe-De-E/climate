import {
  HOT_DAY_MAX_C,
  FROST_DAY_MIN_C,
  HEAVY_RAIN_MM,
  STORM_GUST_KMH,
} from "./extremeThresholds.js";

interface DailyMeans {
  dates: string[];
  values: (number | null)[];
  unit: string;
}

export interface DailyExtremeVariables {
  dates: string[];
  tempMax: (number | null)[];
  tempMin: (number | null)[];
  precipitationSum: (number | null)[];
  windGustsMax: (number | null)[];
}

const MAX_RATE_LIMIT_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
// fetch() has no default timeout — a single connection that hangs (no
// response, no error) would otherwise block a concurrency-pool worker
// forever with nothing to show for it in logs or metrics.
const REQUEST_TIMEOUT_MS = 20000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Open-Meteo's free archive API throttles bursts of concurrent requests
// with a bare 429 (no Retry-After header) — back off with exponential
// delay + jitter instead of failing the whole grid/backfill on the first
// burst. Shared by every archive query (daily means, daily extremes, ...).
async function fetchArchiveJson(url: string): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 300);
        continue;
      }
      throw error;
    }
    if (res.ok) {
      return res.json();
    }
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 300);
      continue;
    }
    throw new Error(`archive API responded with ${res.status}`);
  }
  throw new Error("archive API rate-limit retries exhausted");
}

// timezone is forced to UTC (not "auto") so date labels never shift with the
// clicked location's local time — otherwise days right at a year boundary
// could land in the wrong month depending on where on Earth was clicked.
export async function fetchDailyMeans(
  latGrid: number,
  lngGrid: number,
  year: number,
): Promise<DailyMeans> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${latGrid}&longitude=${lngGrid}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&daily=temperature_2m_mean&timezone=UTC`;

  const data = await fetchArchiveJson(url);
  return {
    dates: data.daily.time,
    values: data.daily.temperature_2m_mean,
    unit: data.daily_units.temperature_2m_mean,
  };
}

// The archive API's underlying ERA5 reanalysis lags a few days behind
// real-time — requesting an end_date past what's actually processed yet
// gets rejected with a 400, not just nulls for the missing days.
const ARCHIVE_PROCESSING_LAG_DAYS = 5;

export async function fetchDailyExtremeVariables(
  latGrid: number,
  lngGrid: number,
  year: number,
): Promise<DailyExtremeVariables> {
  const today = new Date();
  let endDate = `${year}-12-31`;
  if (year === today.getUTCFullYear()) {
    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() - ARCHIVE_PROCESSING_LAG_DAYS);
    endDate = cutoff.toISOString().slice(0, 10);
  }

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${latGrid}&longitude=${lngGrid}` +
    `&start_date=${year}-01-01&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&timezone=UTC`;

  const data = await fetchArchiveJson(url);
  return {
    dates: data.daily.time,
    tempMax: data.daily.temperature_2m_max,
    tempMin: data.daily.temperature_2m_min,
    precipitationSum: data.daily.precipitation_sum,
    windGustsMax: data.daily.wind_gusts_10m_max,
  };
}

export function aggregateToMonthly(dates: string[], values: (number | null)[]) {
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);

  dates.forEach((date, i) => {
    const value = values[i];
    if (value === null || value === undefined) return;
    const monthIndex = Number(date.slice(5, 7)) - 1;
    sums[monthIndex] += value;
    counts[monthIndex] += 1;
  });

  const monthlyMeans = sums.map((sum, i) =>
    counts[i] > 0 ? Math.round((sum / counts[i]) * 10) / 10 : null,
  );

  return { monthlyMeans, daysWithData: counts };
}

export interface ExtremeDayCountsResult {
  hotDays: number;
  frostDays: number;
  heavyRainDays: number;
  stormDays: number;
  daysWithData: number;
}

export function countExtremeDays(
  variables: DailyExtremeVariables,
): ExtremeDayCountsResult {
  const { dates, tempMax, tempMin, precipitationSum, windGustsMax } = variables;
  let hotDays = 0;
  let frostDays = 0;
  let heavyRainDays = 0;
  let stormDays = 0;
  let daysWithData = 0;

  dates.forEach((_, i) => {
    const max = tempMax[i];
    const min = tempMin[i];
    const rain = precipitationSum[i];
    const gust = windGustsMax[i];
    if (max == null && min == null && rain == null && gust == null) return;
    daysWithData += 1;

    if (max != null && max >= HOT_DAY_MAX_C) hotDays += 1;
    if (min != null && min < FROST_DAY_MIN_C) frostDays += 1;
    if (rain != null && rain >= HEAVY_RAIN_MM) heavyRainDays += 1;
    if (gust != null && gust >= STORM_GUST_KMH) stormDays += 1;
  });

  return { hotDays, frostDays, heavyRainDays, stormDays, daysWithData };
}
