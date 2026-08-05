"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "./modal";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const reverseGeocode = async (lat: number, lng: number) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.display_name as string | undefined;
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

interface LocalInfo {
  place: string;
  temperature: string;
  history: HistoryInfo | null;
}

export const Map = ({
  className,
  center = [0, 0],
  zoom = 2,
  mode,
  onMapLoad,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

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
      map.on("click", async (e) => {
        if (modeRef.current !== "local") return;
        const { lat, lng } = e.latlng;
        const [placeResult, temperatureResult, historyResult] =
          await Promise.allSettled([
            reverseGeocode(lat, lng),
            fetchTemperature(lat, lng),
            fetchHistory(lat, lng),
          ]);
        setLocalInfo({
          place:
            placeResult.status === "fulfilled"
              ? (placeResult.value ?? "Unbekannter Ort")
              : "Ort konnte nicht ermittelt werden",
          temperature:
            temperatureResult.status === "fulfilled"
              ? temperatureResult.value
              : "nicht verfügbar",
          history:
            historyResult.status === "fulfilled" ? historyResult.value : null,
        });
        if (historyResult.status === "rejected") {
          console.error("history fetch failed:", historyResult.reason);
        }
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
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%" }}
      />
      <Modal
        open={!!localInfo}
        onClose={() => setLocalInfo(null)}
        title={localInfo?.place}
      >
        <p>Aktuelle Temperatur: {localInfo?.temperature}</p>
        <div style={{ marginTop: 16 }}>
          {localInfo?.history ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>
                      Monat
                    </th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>
                      {localInfo.history.pastYear}
                    </th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>
                      {localInfo.history.recentYear}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MONTH_LABELS.map((label, i) => (
                    <tr
                      key={label}
                      style={{
                        borderTop:
                          "1px solid var(--border, rgba(255,255,255,0.08))",
                      }}
                    >
                      <td style={{ padding: "4px 8px" }}>{label}</td>
                      <td style={{ textAlign: "right", padding: "4px 8px" }}>
                        {localInfo.history?.pastMonthly[i] ?? "n/a"}
                        {localInfo.history?.pastMonthly[i] != null
                          ? localInfo.history.unit
                          : ""}
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 8px" }}>
                        {localInfo.history?.recentMonthly[i] ?? "n/a"}
                        {localInfo.history?.recentMonthly[i] != null
                          ? localInfo.history.unit
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Verlauf nicht verfügbar</p>
          )}
        </div>
      </Modal>
    </>
  );
};
