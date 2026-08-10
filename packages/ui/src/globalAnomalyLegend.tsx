import { COLD_COLOR, WARM_COLOR, NEUTRAL_COLOR, DOMAIN_C } from "./globalAnomalyColor";

interface GlobalAnomalyLegendProps {
  unit: string;
}

export const GlobalAnomalyLegend = ({ unit }: GlobalAnomalyLegendProps) => (
  <div
    style={{
      position: "fixed",
      bottom: 16,
      left: 16,
      zIndex: 1000,
      background: "var(--surface, #1a1d24)",
      border: "1px solid var(--border, #2a2d36)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      color: "var(--foreground-muted, #9aa0ab)",
      maxWidth: 220,
    }}
  >
    <div style={{ marginBottom: 6 }}>Temperaturanomalie</div>
    <div
      style={{
        height: 8,
        borderRadius: 4,
        background: `linear-gradient(90deg, ${COLD_COLOR}, ${NEUTRAL_COLOR}, ${WARM_COLOR})`,
        marginBottom: 4,
      }}
    />
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>≤ −{DOMAIN_C}{unit}</span>
      <span>0</span>
      <span>≥ +{DOMAIN_C}{unit}</span>
    </div>
  </div>
);
