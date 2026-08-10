import mongoose, { Schema } from "mongoose";

const ExtremeDayCountsSchema = new Schema({
  latGrid: { type: Number, required: true },
  lngGrid: { type: Number, required: true },
  year: { type: Number, required: true },
  hotDays: { type: Number, required: true },
  frostDays: { type: Number, required: true },
  heavyRainDays: { type: Number, required: true },
  stormDays: { type: Number, required: true },
  daysWithData: { type: Number, required: true },
  source: { type: String, default: "open-meteo-archive" },
  fetchedAt: { type: Date, default: Date.now },
});

ExtremeDayCountsSchema.index(
  { latGrid: 1, lngGrid: 1, year: 1 },
  { unique: true },
);

export const ExtremeDayCounts = mongoose.model(
  "ExtremeDayCounts",
  ExtremeDayCountsSchema,
);
