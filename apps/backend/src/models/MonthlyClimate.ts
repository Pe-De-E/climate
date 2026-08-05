import mongoose, { Schema } from "mongoose";

const MonthlyClimateSchema = new Schema({
  latGrid: { type: Number, required: true },
  lngGrid: { type: Number, required: true },
  year: { type: Number, required: true },
  // index 0 = January ... 11 = December; entries can be null if a month had
  // zero valid days in the upstream archive
  monthlyMeans: { type: [Number], required: true },
  daysWithData: { type: [Number], required: true },
  unit: { type: String, default: "°C" },
  source: { type: String, default: "open-meteo-archive" },
  fetchedAt: { type: Date, default: Date.now },
});

MonthlyClimateSchema.index(
  { latGrid: 1, lngGrid: 1, year: 1 },
  { unique: true },
);

export const MonthlyClimate = mongoose.model(
  "MonthlyClimate",
  MonthlyClimateSchema,
);
