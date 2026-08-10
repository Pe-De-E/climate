// Fixed, meteorologically standard thresholds (DWD-style "Kenntage") rather
// than location-relative percentiles — a percentile drifts as the climate
// warms, diluting what "extreme" means over time. Comparing the resulting
// day counts against a frozen baseline period (see below) gives the
// climate-change signal instead, without needing a climate-zone dataset.
export const HOT_DAY_MAX_C = 30;
export const FROST_DAY_MIN_C = 0;
export const HEAVY_RAIN_MM = 20;
export const STORM_GUST_KMH = 75;

// WMO climate normal period. Kept fixed (not a rolling window) so the
// comparison stays meaningful as the climate continues to shift.
export const BASELINE_START_YEAR = 1961;
export const BASELINE_END_YEAR = 1990;
