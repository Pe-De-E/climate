"use client";

import { EXTREME_CATEGORIES, type ExtremeDayCounts, type ExtremeThresholds } from "./extremeCategories";
import { colorForCount, NEUTRAL_COLOR } from "./globalAnomalyColor";
import { StatTile } from "./stat-tile";

type ExtremeCategoryKey = keyof ExtremeDayCounts;

export interface ExtremeYearCount extends ExtremeDayCounts {
  year: number;
}

const DECADE_SIZE = 10;
const GRID_MAX_WIDTH = 640;
const cellGap = 6;
const labelWidth = 68;

function groupByDecade(years: ExtremeYearCount[]) {
  const decades = new Map<number, ExtremeYearCount[]>();
  years.forEach((y) => {
    const decadeStart = Math.floor(y.year / DECADE_SIZE) * DECADE_SIZE;
    const bucket = decades.get(decadeStart) ?? [];
    bucket.push(y);
    decades.set(decadeStart, bucket);
  });
  return [...decades.entries()].sort(([a], [b]) => a - b);
}

const average = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

export const ExtremeHistoryPanel = ({
  years,
  category,
  thresholds,
}: {
  years: ExtremeYearCount[];
  category: ExtremeCategoryKey;
  thresholds: ExtremeThresholds;
}) => {
  if (years.length === 0) return null;

  const categoryMeta = EXTREME_CATEGORIES.find((c) => c.key === category)!;
  const counts = years.map((y) => y[category]);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const minYear = years.find((y) => y[category] === minCount)!.year;
  const maxYear = years.find((y) => y[category] === maxCount)!.year;
  const decades = groupByDecade(years);
  const byOffset = new Map(
    decades.map(([start, bucket]) => [start, new Map(bucket.map((y) => [y.year - start, y]))]),
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: categoryMeta.color,
          }}
        />
        <span style={{ fontWeight: 600 }}>{categoryMeta.label}</span>
        <span style={{ fontSize: 12, color: "var(--foreground-muted, #9aa0ab)" }}>
          {categoryMeta.thresholdLabel(thresholds)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, maxWidth: GRID_MAX_WIDTH }}>
        <StatTile label={`Minimum (${minYear})`} value={minCount} unit=" Tage" />
        <StatTile label={`Maximum (${maxYear})`} value={maxCount} unit=" Tage" />
        <StatTile
          label={`Ø ${years[0]!.year}–${years[years.length - 1]!.year}`}
          value={Math.round(average(counts) * 10) / 10}
          unit=" Tage"
        />
      </div>

      <div style={{ maxWidth: GRID_MAX_WIDTH, marginBottom: 20 }}>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${NEUTRAL_COLOR}, ${categoryMeta.color})`,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--foreground-muted, #9aa0ab)",
            marginTop: 4,
          }}
        >
          <span>{minCount} Tage</span>
          <span>{maxCount} Tage</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: cellGap, maxWidth: GRID_MAX_WIDTH }}>
        {decades.map(([decadeStart]) => {
          const offsets = byOffset.get(decadeStart)!;
          const decadeAvg = average([...offsets.values()].map((y) => y[category]));
          return (
            <div key={decadeStart} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: labelWidth,
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--foreground-muted, #9aa0ab)",
                  textAlign: "right",
                  lineHeight: 1.3,
                }}
              >
                <div>{decadeStart}er</div>
                <div>Ø {Math.round(decadeAvg)}</div>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: `repeat(${DECADE_SIZE}, minmax(0, 1fr))`,
                  gap: cellGap,
                }}
              >
                {Array.from({ length: DECADE_SIZE }, (_, offset) => {
                  const entry = offsets.get(offset);
                  if (!entry) {
                    return <div key={offset} style={{ aspectRatio: "1" }} />;
                  }
                  const value = entry[category];
                  const t =
                    maxCount > minCount ? (value - minCount) / (maxCount - minCount) : 1;
                  return (
                    <div
                      key={offset}
                      title={`${entry.year}: ${value} Tage`}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 4,
                        background: colorForCount(value, minCount, maxCount, categoryMeta.color),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: `rgba(255,255,255,${0.5 + t * 0.5})`,
                      }}
                    >
                      {value}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
