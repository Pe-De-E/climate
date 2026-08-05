interface DailyMeans {
  dates: string[];
  values: (number | null)[];
  unit: string;
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

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`archive API responded with ${res.status}`);
  }

  const data = await res.json();
  return {
    dates: data.daily.time,
    values: data.daily.temperature_2m_mean,
    unit: data.daily_units.temperature_2m_mean,
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
