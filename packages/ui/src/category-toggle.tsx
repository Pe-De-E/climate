"use client";

import { EXTREME_CATEGORIES, type ExtremeDayCounts } from "./extremeCategories";

type ExtremeCategoryKey = keyof ExtremeDayCounts;

export const CategoryToggle = ({
  active,
  onChange,
}: {
  active: ExtremeCategoryKey;
  onChange: (key: ExtremeCategoryKey) => void;
}) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {EXTREME_CATEGORIES.map((category) => {
      const isActive = category.key === active;
      return (
        <button
          key={category.key}
          type="button"
          onClick={() => onChange(category.key)}
          aria-pressed={isActive}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            border: "none",
            background: isActive ? category.color : "rgba(255,255,255,0.04)",
            color: isActive ? "#fff" : "inherit",
            font: "inherit",
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isActive ? "#fff" : category.color,
            }}
          />
          {category.label}
        </button>
      );
    })}
  </div>
);
