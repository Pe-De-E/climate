"use client";

import {
  DAILY_FLAG_KEY,
  EXTREME_CATEGORIES,
  longestStreak,
  type DailyExtremeFlags,
  type ExtremeDayCounts,
  type StreakInfo,
} from "./extremeCategories";

type ExtremeCategoryKey = keyof ExtremeDayCounts;

interface CalendarCell {
  date: string | null;
  active: boolean;
  hasData: boolean;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(2000, i, 1)),
);

// GitHub-style grid: weeks as columns, Monday..Sunday as rows. Padded with
// empty leading cells so the first real day lands on its correct weekday row.
function buildWeeks(
  days: DailyExtremeFlags[],
  flagKey: keyof DailyExtremeFlags,
): CalendarCell[][] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const firstDate = new Date(`${days[0]!.date}T00:00:00Z`);
  const lastDate = new Date(`${days[days.length - 1]!.date}T00:00:00Z`);
  const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

  const cells: CalendarCell[] = [];
  const leadingPad = mondayIndex(firstDate.getUTCDay());
  for (let i = 0; i < leadingPad; i++) {
    cells.push({ date: null, active: false, hasData: false });
  }

  const cursor = new Date(firstDate);
  while (cursor.getTime() <= lastDate.getTime()) {
    const iso = cursor.toISOString().slice(0, 10);
    const day = byDate.get(iso);
    cells.push({
      date: iso,
      active: day ? Boolean(day[flagKey]) : false,
      hasData: day?.hasData ?? false,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));

const formatDayMonth = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function formatStreakRange(streak: StreakInfo) {
  if (streak.startDate === streak.endDate) return formatDayMonth(streak.startDate);
  const sameMonth = streak.startDate.slice(5, 7) === streak.endDate.slice(5, 7);
  return sameMonth
    ? `${formatDay(streak.startDate)}.–${formatDayMonth(streak.endDate)}`
    : `${formatDayMonth(streak.startDate)} – ${formatDayMonth(streak.endDate)}`;
}

function monthLabelsForWeeks(weeks: CalendarCell[][]) {
  const labels: (string | null)[] = [];
  let lastMonth = -1;
  weeks.forEach((week) => {
    const firstDated = week.find((cell) => cell.date !== null);
    if (!firstDated?.date) {
      labels.push(null);
      return;
    }
    const month = Number(firstDated.date.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      labels.push(MONTH_LABELS[month]!);
      lastMonth = month;
    } else {
      labels.push(null);
    }
  });
  return labels;
}

export const ExtremeDayCalendar = ({
  year,
  days,
  category,
}: {
  year: number;
  days: DailyExtremeFlags[];
  category: ExtremeCategoryKey;
}) => {
  const flagKey = DAILY_FLAG_KEY[category];
  const weeks = buildWeeks(days, flagKey);
  const monthLabels = monthLabelsForWeeks(weeks);
  const activeCount = days.filter((d) => d[flagKey]).length;
  const streak = longestStreak(days, category);
  const color = EXTREME_CATEGORIES.find((c) => c.key === category)!.color;
  const isInProgressYear = year === new Date().getUTCFullYear();
  const cellSize = 11;
  const cellGap = 3;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {isInProgressYear ? `${year} bis heute` : year}
        </span>
        <span style={{ fontSize: 12, color: "var(--foreground-muted, #9aa0ab)" }}>
          {activeCount} Tage
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--foreground-muted, #9aa0ab)", marginBottom: 8 }}>
        Längste Serie:{" "}
        {streak
          ? `${streak.length} ${streak.length === 1 ? "Tag" : "Tage"} (${formatStreakRange(streak)})`
          : "–"}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: cellGap }}>
            {monthLabels.map((label, i) => (
              <div
                key={i}
                style={{
                  width: cellSize,
                  fontSize: 10,
                  color: "var(--foreground-muted, #9aa0ab)",
                }}
              >
                {label ?? ""}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: cellGap }}>
            {weeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                style={{ display: "flex", flexDirection: "column", gap: cellGap }}
              >
                {week.map((cell, dayIndex) => (
                  <div
                    key={dayIndex}
                    title={cell.date ?? undefined}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 2,
                      background: !cell.date
                        ? "transparent"
                        : cell.active
                          ? color
                          : "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
