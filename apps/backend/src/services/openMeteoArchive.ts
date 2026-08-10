interface DailyMeans {
  dates: string[];
  values: (number | null)[];
  unit: string;
}

const MAX_RATE_LIMIT_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
// fetch() has no default timeout — a single connection that hangs (no
// response, no error) would otherwise block a concurrency-pool worker
// forever with nothing to show for it in logs or metrics.
const REQUEST_TIMEOUT_MS = 20000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // Open-Meteo's free archive API throttles bursts of concurrent requests
  // with a bare 429 (no Retry-After header) — back off with exponential
  // delay + jitter instead of failing the whole grid on the first burst.
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
      const data = await res.json();
      return {
        dates: data.daily.time,
        values: data.daily.temperature_2m_mean,
        unit: data.daily_units.temperature_2m_mean,
      };
    }
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 300);
      continue;
    }
    throw new Error(`archive API responded with ${res.status}`);
  }
  throw new Error("archive API rate-limit retries exhausted");
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
