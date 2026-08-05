import { MonthlyClimate } from "../models/MonthlyClimate.js";
import { fetchDailyMeans, aggregateToMonthly } from "./openMeteoArchive.js";

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
