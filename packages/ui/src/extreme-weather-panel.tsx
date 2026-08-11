"use client";

import { useState } from "react";
import { StatTile } from "./stat-tile";
import { YearPickerModal } from "./year-picker-modal";
import {
  EXTREME_CATEGORIES,
  type ExtremeDayCounts,
  type ExtremeThresholds,
} from "./extremeCategories";

export type { ExtremeDayCounts, ExtremeThresholds };

export interface ExtremesInfo {
  year: number;
  counts: ExtremeDayCounts;
  baselinePeriod: string;
  baselineCounts: ExtremeDayCounts;
  thresholds: ExtremeThresholds;
}

interface ExtremeWeatherPanelProps {
  info: ExtremesInfo;
  onSelectYear: (year: number) => void;
}

export const ExtremeWeatherPanel = ({
  info,
  onSelectYear,
}: ExtremeWeatherPanelProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const currentYear = new Date().getUTCFullYear();
  const maxSelectableYear = currentYear - 1;
  const isCurrentYear = info.year === currentYear;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--foreground-muted, #9aa0ab)" }}>
          Vergleich ggü. Klimanormalperiode {info.baselinePeriod}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {!isCurrentYear && (
            <button
              type="button"
              onClick={() => onSelectYear(currentYear)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: "none",
                color: "inherit",
                font: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Dieses Jahr (bis heute)
            </button>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
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
              cursor: "pointer",
            }}
          >
            {info.year}
            {isCurrentYear ? " (bis heute)" : ""}
            <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
          </button>
        </div>
      </div>

      <YearPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Jahr wählen"
        color="var(--accent, #0f766e)"
        initialYear={info.year}
        maxYear={maxSelectableYear}
        onConfirm={(year) => {
          setPickerOpen(false);
          onSelectYear(year);
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {EXTREME_CATEGORIES.map((category) => {
          const count = info.counts[category.key];
          const baselineCount = info.baselineCounts[category.key];
          const delta = Math.round((count - baselineCount) * 10) / 10;
          return (
            <div key={category.key}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: category.color,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{category.label}</span>
                <span style={{ fontSize: 12, color: "var(--foreground-muted, #9aa0ab)" }}>
                  {category.thresholdLabel(info.thresholds)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <StatTile
                  label={isCurrentYear ? `${info.year} bis heute` : String(info.year)}
                  value={count}
                  unit=" Tage"
                />
                <StatTile
                  label={`Ø ${info.baselinePeriod}`}
                  value={baselineCount}
                  unit=" Tage"
                />
                <StatTile
                  label="Differenz"
                  value={delta}
                  unit=" Tage"
                  signed
                  color={category.color}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
