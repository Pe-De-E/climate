import mongoose, { Schema } from "mongoose";

const GlobalAnomalyCellSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    delta: { type: Number, required: true },
  },
  { _id: false },
);

const GlobalAnomalyGridSchema = new Schema({
  resolution: { type: Number, required: true },
  year1: { type: Number, required: true },
  year2: { type: Number, required: true },
  unit: { type: String, default: "°C" },
  cells: { type: [GlobalAnomalyCellSchema], required: true },
  source: { type: String, default: "open-meteo-archive" },
  fetchedAt: { type: Date, default: Date.now },
});

GlobalAnomalyGridSchema.index(
  { resolution: 1, year1: 1, year2: 1 },
  { unique: true },
);

export const GlobalAnomalyGrid = mongoose.model(
  "GlobalAnomalyGrid",
  GlobalAnomalyGridSchema,
);
