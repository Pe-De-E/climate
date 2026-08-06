"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "./modal";
import { TemperatureChart } from "./temperature-chart";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const reverseGeocode = async (lat: number, lng: number) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.display_name as string | undefined) ?? "Unbekannter Ort";
};

const WEATHER_API_URL = "http://localhost:3001/api/weather/current";

const fetchTemperature = async (lat: number, lng: number) => {
  const res = await fetch(`${WEATHER_API_URL}?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`weather API responded with ${res.status}`);
  const data = await res.json();
  return `${data.temperature}${data.unit}` as string;
};

const HISTORY_API_URL = "http://localhost:3001/api/weather/history";

interface HistoryInfo {
  recentYear: number;
  pastYear: number;
  unit: string;
  recentMonthly: (number | null)[];
  pastMonthly: (number | null)[];
}

const fetchHistory = async (lat: number, lng: number): Promise<HistoryInfo> => {
  const res = await fetch(`${HISTORY_API_URL}?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`history API responded with ${res.status}`);
  const data = await res.json();
  return {
    recentYear: data.recentYear,
    pastYear: data.pastYear,
    unit: data.unit,
    recentMonthly: data.recent.monthlyMeans,
    pastMonthly: data.past.monthlyMeans,
  };
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("de-DE", { month: "short" }).format(
    new Date(2000, i, 1),
  ),
);

export type MapMode = "local";

interface MapProps {
  className?: string;
  /** [latitude, longitude] */
  center?: [number, number];
  zoom?: number;
  mode?: MapMode;
  onMapLoad?: (map: L.Map) => void;
}

type FieldState<T> =
  | { status: "loading" }
  | { status: "done"; value: T }
  | { status: "error" };

interface LocalSession {
  place: FieldState<string>;
  temperature: FieldState<string>;
  history: FieldState<HistoryInfo>;
}

const Skeleton = ({ width, height }: { width: number | string; height: number }) => (
  <span
    style={{
      display: "inline-block",
      width,
      height,
      borderRadius: 4,
      background:
        "linear-gradient(90deg, var(--border, #2a2d36) 25%, rgba(255,255,255,0.08) 50%, var(--border, #2a2d36) 75%)",
      backgroundSize: "200% 100%",
      animation:
        "weather-skeleton-shimmer 1.4s ease-in-out infinite, weather-skeleton-pulse 1.8s ease-in-out infinite",
    }}
  />
);

export const Map = ({
  className,
  center = [0, 0],
  zoom = 2,
  mode,
  onMapLoad,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: false }).setView(
        center,
        zoom,
      );
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      map.on("click", (e) => {
        if (modeRef.current !== "local") return;
        const { lat, lng } = e.latlng;
        const requestId = ++requestIdRef.current;
        const isStale = () => requestIdRef.current !== requestId;

        setSession({
          place: { status: "loading" },
          temperature: { status: "loading" },
          history: { status: "loading" },
        });

        reverseGeocode(lat, lng).then(
          (value) => {
            if (isStale()) return;
            setSession((s) => s && { ...s, place: { status: "done", value } });
          },
          () => {
            if (isStale()) return;
            setSession((s) => s && { ...s, place: { status: "error" } });
          },
        );

        fetchTemperature(lat, lng).then(
          (value) => {
            if (isStale()) return;
            setSession(
              (s) => s && { ...s, temperature: { status: "done", value } },
            );
          },
          () => {
            if (isStale()) return;
            setSession((s) => s && { ...s, temperature: { status: "error" } });
          },
        );

        fetchHistory(lat, lng).then(
          (value) => {
            if (isStale()) return;
            setSession((s) => s && { ...s, history: { status: "done", value } });
          },
          (error) => {
            if (isStale()) return;
            console.error("history fetch failed:", error);
            setSession((s) => s && { ...s, history: { status: "error" } });
          },
        );
      });
      mapRef.current = map;
      onMapLoad?.(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // center/zoom are only applied on initial mount; changing them afterwards
    // should pan/zoom the existing map instance instead of recreating it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        @keyframes weather-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes weather-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%" }}
      />
      <Modal
        open={!!session}
        onClose={() => setSession(null)}
        title={
          session?.place.status === "done" ? (
            session.place.value
          ) : session?.place.status === "error" ? (
            "Ort konnte nicht ermittelt werden"
          ) : (
            <Skeleton width={140} height={16} />
          )
        }
      >
        <p>
          Aktuelle Temperatur:{" "}
          {session?.temperature.status === "done" ? (
            session.temperature.value
          ) : session?.temperature.status === "error" ? (
            "nicht verfügbar"
          ) : (
            <Skeleton width={60} height={14} />
          )}
        </p>
        <div style={{ marginTop: 16 }}>
          {session?.history.status === "done" ? (
            <HistoryContent history={session.history.value} />
          ) : session?.history.status === "error" ? (
            <p>Verlauf nicht verfügbar</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <Skeleton width="100%" height={46} />
                <Skeleton width="100%" height={46} />
                <Skeleton width="100%" height={46} />
              </div>
              <Skeleton width="100%" height={220} />
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

const HistoryContent = ({ history }: { history: HistoryInfo }) => (
  <>
    <TemperatureChart
      pastYear={history.pastYear}
      recentYear={history.recentYear}
      pastMonthly={history.pastMonthly}
      recentMonthly={history.recentMonthly}
      unit={history.unit}
    />
    <details style={{ marginTop: 16 }}>
      <summary
        style={{
          cursor: "pointer",
          color: "var(--foreground-muted, #9aa0ab)",
          fontSize: 13,
        }}
      >
        Als Tabelle anzeigen
      </summary>
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Monat</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>
                {history.pastYear}
              </th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>
                {history.recentYear}
              </th>
            </tr>
          </thead>
          <tbody>
            {MONTH_LABELS.map((label, i) => (
              <tr
                key={label}
                style={{
                  borderTop: "1px solid var(--border, rgba(255,255,255,0.08))",
                }}
              >
                <td style={{ padding: "4px 8px" }}>{label}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>
                  {history.pastMonthly[i] ?? "n/a"}
                  {history.pastMonthly[i] != null ? history.unit : ""}
                </td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>
                  {history.recentMonthly[i] ?? "n/a"}
                  {history.recentMonthly[i] != null ? history.unit : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  </>
);
