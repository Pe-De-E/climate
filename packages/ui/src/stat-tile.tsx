export const StatTile = ({
  label,
  value,
  unit,
  signed,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  signed?: boolean;
  color?: string;
}) => (
  <div
    style={{
      flex: 1,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--border, #2a2d36)",
      borderRadius: 8,
      padding: "10px 14px",
    }}
  >
    <div style={{ fontSize: 11, color: "var(--foreground-muted, #9aa0ab)", marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 600, color: color ?? "inherit" }}>
      {value === null
        ? "n/a"
        : `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`}
    </div>
  </div>
);
