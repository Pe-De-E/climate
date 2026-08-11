import { COLD_COLOR, WARM_COLOR } from "./globalAnomalyColor";

// Slots 3 (aqua) & 7 (violet) from the validated dataviz palette, chosen for
// Starkregen/Sturm alongside the already-used slot 1 (blue, Frost) and
// slot 8 (red, Hitze) — checked as a 4-color set with
// scripts/validate_palette.js against this app's dark surface (#1a1d24):
// worst adjacent CVD ΔE 17.3, normal-vision ΔE 20.9, all pass.
const HEAVY_RAIN_COLOR = "#199e70";
const STORM_COLOR = "#9085e9";

export interface ExtremeDayCounts {
  hotDays: number;
  frostDays: number;
  heavyRainDays: number;
  stormDays: number;
}

export interface ExtremeThresholds {
  hotDayMaxC: number;
  frostDayMinC: number;
  heavyRainMm: number;
  stormGustKmh: number;
}

export interface ExtremeCategory {
  key: keyof ExtremeDayCounts;
  label: string;
  thresholdLabel: (t: ExtremeThresholds) => string;
  color: string;
}

export interface DailyExtremeFlags {
  date: string;
  hotDay: boolean;
  frostDay: boolean;
  heavyRainDay: boolean;
  stormDay: boolean;
  hasData: boolean;
}

export type DailyFlagKey = "hotDay" | "frostDay" | "heavyRainDay" | "stormDay";

// Maps a yearly-count key (as used by ExtremeDayCounts/ExtremesInfo) to the
// matching per-day boolean field on DailyExtremeFlags.
export const DAILY_FLAG_KEY: Record<keyof ExtremeDayCounts, DailyFlagKey> = {
  hotDays: "hotDay",
  frostDays: "frostDay",
  heavyRainDays: "heavyRainDay",
  stormDays: "stormDay",
};

export const EXTREME_CATEGORIES: ExtremeCategory[] = [
  {
    key: "hotDays",
    label: "Hitzetage",
    thresholdLabel: (t) => `Tmax ≥ ${t.hotDayMaxC}°C`,
    color: WARM_COLOR,
  },
  {
    key: "frostDays",
    label: "Frosttage",
    thresholdLabel: (t) => `Tmin < ${t.frostDayMinC}°C`,
    color: COLD_COLOR,
  },
  {
    key: "heavyRainDays",
    label: "Starkregentage",
    thresholdLabel: (t) => `Niederschlag ≥ ${t.heavyRainMm}mm`,
    color: HEAVY_RAIN_COLOR,
  },
  {
    key: "stormDays",
    label: "Sturmtage",
    thresholdLabel: (t) => `Böen ≥ ${t.stormGustKmh}km/h`,
    color: STORM_COLOR,
  },
];
