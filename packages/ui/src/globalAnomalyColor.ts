// Diverging pair from the validated dataviz palette (categorical slots 1 & 8,
// dark-mode values) — checked with scripts/validate_palette.js against this
// app's dark surface (#1a1d24): CVD ΔE 19.2/31.4, normal-vision ΔE 29.0, all
// checks pass. Neutral midpoint is the palette's dark diverging gray.
export const COLD_COLOR = "#3987e5";
export const WARM_COLOR = "#e66767";
export const NEUTRAL_COLOR = "#383835";

// Fixed, not data-driven: keeps color meaning stable across different
// year-pair queries instead of an outlier cell washing out the rest of the
// map. Cells beyond this clamp render at full-intensity end color.
export const DOMAIN_C = 5;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(fromHex: string, toHex: string, t: number) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const r = Math.round(lerp(from.r, to.r, t));
  const g = Math.round(lerp(from.g, to.g, t));
  const b = Math.round(lerp(from.b, to.b, t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** delta in °C -> a color continuously interpolated through the neutral
 * midpoint at 0, clamped to the ±DOMAIN_C ends. */
export function colorForDelta(delta: number) {
  const clamped = Math.max(-DOMAIN_C, Math.min(DOMAIN_C, delta));
  const t = Math.abs(clamped) / DOMAIN_C;
  const pole = clamped < 0 ? COLD_COLOR : WARM_COLOR;
  return lerpColor(NEUTRAL_COLOR, pole, t);
}
