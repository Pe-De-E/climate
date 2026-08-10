"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { StatTile } from "./stat-tile";
import { YearPickerModal } from "./year-picker-modal";

// Categorical slots 1 (blue) & 2 (orange) from the validated dataviz palette —
// checked with scripts/validate_palette.js against this app's dark surface
// (#1a1d24): CVD ΔE 26.8/32.4, normal-vision ΔE 31.8, contrast >=3:1, all pass.
const SERIES_PAST = "#3987e5";
const SERIES_RECENT = "#d95926";

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("de-DE", { month: "short" }).format(
    new Date(2000, i, 1),
  ),
);

const MARGIN = { top: 16, right: 16, bottom: 28, left: 36 };
const WIDTH = 640;
const HEIGHT = 220;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function niceTicks(min: number, max: number, targetCount = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rawStep = (max - min) / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step =
    [1, 2, 5, 10].map((s) => s * magnitude).find((s) => s >= rawStep) ??
    10 * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v * 10) / 10);
  }
  return ticks;
}

function splitRuns(values: (number | null)[]) {
  const runs: number[][] = [];
  let current: number[] = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) runs.push(current);
  return runs;
}

// Monotone cubic (Fritsch-Carlson): smooth, never overshoots past a local
// min/max the way a plain Catmull-Rom spline can.
function monotonePath(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    dx[i] = p1.x - p0.x;
    dy[i] = p1.y - p0.y;
    m[i] = dy[i]! / dx[i]!;
  }
  const t: number[] = new Array(n);
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  }
  const start = points[0]!;
  let d = `M${start.x},${start.y} `;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]!;
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (t[i]! * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (t[i + 1]! * h) / 3;
    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y} `;
  }
  return d.trim();
}

function buildSmoothLinePath(
  values: (number | null)[],
  xForIndex: (i: number) => number,
  yForValue: (v: number) => number,
) {
  return splitRuns(values)
    .map((run) => {
      if (run.length < 2) return "";
      const points = run.map((i) => ({
        x: xForIndex(i),
        y: yForValue(values[i] as number),
      }));
      return monotonePath(points);
    })
    .filter(Boolean)
    .join(" ");
}

function buildSmoothAreaPath(
  values: (number | null)[],
  xForIndex: (i: number) => number,
  yForValue: (v: number) => number,
  baselineY: number,
) {
  return splitRuns(values)
    .map((run) => {
      if (run.length < 2) return "";
      const points = run.map((i) => ({
        x: xForIndex(i),
        y: yForValue(values[i] as number),
      }));
      const line = monotonePath(points);
      const first = points[0]!;
      const last = points[points.length - 1]!;
      return `${line} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
    })
    .filter(Boolean)
    .join(" ");
}

function lastValidIndex(values: (number | null)[]) {
  return values.reduce<number>(
    (acc, v, i) => (v !== null && v !== undefined ? i : acc),
    -1,
  );
}

function average(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

interface TemperatureChartProps {
  pastYear: number;
  recentYear: number;
  pastMonthly: (number | null)[];
  recentMonthly: (number | null)[];
  unit: string;
  onSelectPastYear?: (year: number) => void;
  onSelectRecentYear?: (year: number) => void;
}

export const TemperatureChart = ({
  pastYear,
  recentYear,
  pastMonthly,
  recentMonthly,
  unit,
  onSelectPastYear,
  onSelectRecentYear,
}: TemperatureChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [openPicker, setOpenPicker] = useState<"past" | "recent" | null>(null);
  const gradientIdPrefix = useId();
  const maxSelectableYear = new Date().getUTCFullYear() - 1;

  const allValues = [...pastMonthly, ...recentMonthly].filter(
    (v): v is number => v !== null && v !== undefined,
  );

  const ticks = useMemo(
    () =>
      allValues.length > 0
        ? niceTicks(Math.min(...allValues), Math.max(...allValues))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pastMonthly, recentMonthly],
  );

  if (allValues.length === 0) {
    return <p>Keine Daten verfügbar.</p>;
  }

  const pastAvg = average(pastMonthly);
  const recentAvg = average(recentMonthly);
  const delta = pastAvg !== null && recentAvg !== null ? recentAvg - pastAvg : null;

  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]!;
  const xForIndex = (i: number) => MARGIN.left + (i / 11) * PLOT_WIDTH;
  const yForValue = (v: number) =>
    MARGIN.top + PLOT_HEIGHT * (1 - (v - yMin) / (yMax - yMin));
  const baselineY = MARGIN.top + PLOT_HEIGHT;

  const pastLine = buildSmoothLinePath(pastMonthly, xForIndex, yForValue);
  const recentLine = buildSmoothLinePath(recentMonthly, xForIndex, yForValue);
  const pastArea = buildSmoothAreaPath(pastMonthly, xForIndex, yForValue, baselineY);
  const recentArea = buildSmoothAreaPath(recentMonthly, xForIndex, yForValue, baselineY);
  const lastPastIndex = lastValidIndex(pastMonthly);
  const lastRecentIndex = lastValidIndex(recentMonthly);

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const svgPoint = point.matrixTransform(ctm.inverse());
    const index = Math.round(((svgPoint.x - MARGIN.left) / PLOT_WIDTH) * 11);
    setHoverIndex(Math.min(11, Math.max(0, index)));
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <StatTile label={`Ø ${pastYear}`} value={pastAvg} unit={unit} />
        <StatTile label={`Ø ${recentYear}`} value={recentAvg} unit={unit} />
        <StatTile
          label="Differenz"
          value={delta}
          unit={unit}
          signed
          color={SERIES_RECENT}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          fontSize: 13,
          color: "var(--foreground-muted, #9aa0ab)",
        }}
      >
        {onSelectPastYear ? (
          <LegendPill
            color={SERIES_PAST}
            label={String(pastYear)}
            onClick={() => setOpenPicker("past")}
          />
        ) : (
          <LegendPill color={SERIES_PAST} label={String(pastYear)} />
        )}
        {onSelectRecentYear ? (
          <LegendPill
            color={SERIES_RECENT}
            label={String(recentYear)}
            onClick={() => setOpenPicker("recent")}
          />
        ) : (
          <LegendPill color={SERIES_RECENT} label={String(recentYear)} />
        )}
      </div>

      {onSelectPastYear && (
        <YearPickerModal
          open={openPicker === "past"}
          onClose={() => setOpenPicker(null)}
          title="Erstes Jahr wählen"
          color={SERIES_PAST}
          initialYear={pastYear}
          maxYear={maxSelectableYear}
          onConfirm={(year) => {
            setOpenPicker(null);
            onSelectPastYear(year);
          }}
        />
      )}
      {onSelectRecentYear && (
        <YearPickerModal
          open={openPicker === "recent"}
          onClose={() => setOpenPicker(null)}
          title="Zweites Jahr wählen"
          color={SERIES_RECENT}
          initialYear={recentYear}
          maxYear={maxSelectableYear}
          onConfirm={(year) => {
            setOpenPicker(null);
            onSelectRecentYear(year);
          }}
        />
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={`${gradientIdPrefix}-past`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_PAST} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES_PAST} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gradientIdPrefix}-recent`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_RECENT} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES_RECENT} stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yForValue(tick)}
              y2={yForValue(tick)}
              stroke="var(--border, #2a2d36)"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={yForValue(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--foreground-muted, #9aa0ab)"
            >
              {tick}°
            </text>
          </g>
        ))}

        {MONTH_LABELS.map((label, i) => (
          <text
            key={label}
            x={xForIndex(i)}
            y={HEIGHT - MARGIN.bottom + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--foreground-muted, #9aa0ab)"
          >
            {label}
          </text>
        ))}

        {hoverIndex !== null && (
          <line
            x1={xForIndex(hoverIndex)}
            x2={xForIndex(hoverIndex)}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
            stroke="var(--foreground-muted, #9aa0ab)"
            strokeWidth={1}
          />
        )}

        <path d={pastArea} fill={`url(#${gradientIdPrefix}-past)`} stroke="none" />
        <path d={recentArea} fill={`url(#${gradientIdPrefix}-recent)`} stroke="none" />

        <path
          d={pastLine}
          fill="none"
          stroke={SERIES_PAST}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={recentLine}
          fill="none"
          stroke={SERIES_RECENT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {lastPastIndex >= 0 && (
          <EndMarker
            x={xForIndex(lastPastIndex)}
            y={yForValue(pastMonthly[lastPastIndex] as number)}
            color={SERIES_PAST}
          />
        )}
        {lastRecentIndex >= 0 && (
          <EndMarker
            x={xForIndex(lastRecentIndex)}
            y={yForValue(recentMonthly[lastRecentIndex] as number)}
            color={SERIES_RECENT}
          />
        )}

        {hoverIndex !== null &&
          [
            { values: pastMonthly, color: SERIES_PAST },
            { values: recentMonthly, color: SERIES_RECENT },
          ].map(({ values, color }, seriesIdx) => {
            const v = values[hoverIndex];
            if (v === null || v === undefined) return null;
            return (
              <circle
                key={seriesIdx}
                cx={xForIndex(hoverIndex)}
                cy={yForValue(v)}
                r={4}
                fill={color}
                stroke="var(--surface, #1a1d24)"
                strokeWidth={2}
              />
            );
          })}
      </svg>

      {hoverIndex !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(xForIndex(hoverIndex) / WIDTH) * 100}%`,
            top: 0,
            transform: hoverIndex > 8 ? "translateX(-100%)" : "translateX(8px)",
            background: "var(--surface-hover, #21252d)",
            border: "1px solid var(--border, #2a2d36)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              color: "var(--foreground-muted, #9aa0ab)",
              marginBottom: 4,
            }}
          >
            {MONTH_LABELS[hoverIndex]}
          </div>
          {pastMonthly[hoverIndex] != null && (
            <div>
              <span style={{ color: SERIES_PAST }}>●</span>{" "}
              <strong>
                {pastMonthly[hoverIndex]}
                {unit}
              </strong>{" "}
              <span style={{ color: "var(--foreground-muted, #9aa0ab)" }}>
                {pastYear}
              </span>
            </div>
          )}
          {recentMonthly[hoverIndex] != null && (
            <div>
              <span style={{ color: SERIES_RECENT }}>●</span>{" "}
              <strong>
                {recentMonthly[hoverIndex]}
                {unit}
              </strong>{" "}
              <span style={{ color: "var(--foreground-muted, #9aa0ab)" }}>
                {recentYear}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LegendPill = ({
  color,
  label,
  onClick,
}: {
  color: string;
  label: string;
  onClick?: () => void;
}) => {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "none",
        color: "inherit",
        font: "inherit",
        fontSize: 13,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
      {onClick && (
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      )}
    </Tag>
  );
};

const EndMarker = ({ x, y, color }: { x: number; y: number; color: string }) => (
  <>
    <circle cx={x} cy={y} r={8} fill={color} opacity={0.18} />
    <circle cx={x} cy={y} r={4} fill={color} stroke="var(--surface, #1a1d24)" strokeWidth={2} />
  </>
);

