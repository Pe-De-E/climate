"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal } from "./modal";
import { TemperatureChart } from "./temperature-chart";
import { GlobalAnomalyLegend } from "./globalAnomalyLegend";
import { colorForDelta } from "./globalAnomalyColor";
import { ExtremeWeatherPanel, type ExtremesInfo } from "./extreme-weather-panel";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const reverseGeocode = async (lat: number, lng: number) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.display_name as string | undefined) ?? "Unbekannter Ort";
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

const WEATHER_API_URL = `${BACKEND_URL}/api/weather/current`;

const fetchTemperature = async (lat: number, lng: number) => {
  const res = await fetch(`${WEATHER_API_URL}?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`weather API responded with ${res.status}`);
  const data = await res.json();
  return `${data.temperature}${data.unit}` as string;
};

const HISTORY_API_URL = `${BACKEND_URL}/api/weather/history`;

interface HistoryInfo {
  recentYear: number;
  pastYear: number;
  unit: string;
  recentMonthly: (number | null)[];
  pastMonthly: (number | null)[];
}

const fetchHistory = async (
  lat: number,
  lng: number,
  year1: number,
  year2: number,
): Promise<HistoryInfo> => {
  const res = await fetch(
    `${HISTORY_API_URL}?lat=${lat}&lng=${lng}&year1=${year1}&year2=${year2}`,
  );
  if (!res.ok) throw new Error(`history API responded with ${res.status}`);
  const data = await res.json();
  const years = data.years as {
    year: number;
    monthlyMeans: (number | null)[];
  }[];
  const first = years[0]!;
  const second = years[1]!;
  return {
    unit: data.unit,
    pastYear: first.year,
    pastMonthly: first.monthlyMeans,
    recentYear: second.year,
    recentMonthly: second.monthlyMeans,
  };
};

const EXTREMES_API_URL = `${BACKEND_URL}/api/weather/extremes`;

const fetchExtremeDays = async (
  lat: number,
  lng: number,
  year: number,
): Promise<ExtremesInfo> => {
  const res = await fetch(
    `${EXTREMES_API_URL}?lat=${lat}&lng=${lng}&year=${year}`,
  );
  if (!res.ok) throw new Error(`extremes API responded with ${res.status}`);
  const data = await res.json();
  return {
    year: data.year,
    counts: data.counts,
    baselinePeriod: data.baseline.period,
    baselineCounts: data.baseline.counts,
    thresholds: data.thresholds,
  };
};

const DEFAULT_YEARS_AGO = 40;

const defaultYears = () => {
  const recentYear = new Date().getUTCFullYear() - 1;
  return { year1: recentYear - DEFAULT_YEARS_AGO, year2: recentYear };
};

const GLOBAL_API_URL = `${BACKEND_URL}/api/weather/global`;
const GLOBAL_RESOLUTION = 2;

interface GlobalGridCell {
  lat: number;
  lng: number;
  delta: number;
}

interface GlobalGridResult {
  cells: GlobalGridCell[];
  unit: string;
}

const fetchGlobalGrid = async (
  year1: number,
  year2: number,
  resolution: number,
): Promise<GlobalGridResult> => {
  const res = await fetch(
    `${GLOBAL_API_URL}?year1=${year1}&year2=${year2}&resolution=${resolution}`,
  );
  if (!res.ok) throw new Error(`global API responded with ${res.status}`);
  const data = await res.json();
  return { cells: data.cells, unit: data.unit };
};

const GLOBAL_PROGRESS_API_URL = `${BACKEND_URL}/api/weather/global/progress`;
const PROGRESS_POLL_INTERVAL_MS = 3000;

interface GlobalGridProgress {
  done: number;
  total: number;
}

const fetchGlobalGridProgress = async (
  year1: number,
  year2: number,
  resolution: number,
): Promise<GlobalGridProgress> => {
  const res = await fetch(
    `${GLOBAL_PROGRESS_API_URL}?year1=${year1}&year2=${year2}&resolution=${resolution}`,
  );
  if (!res.ok) throw new Error(`progress API responded with ${res.status}`);
  return res.json();
};

function buildGridLayer(
  Leaflet: typeof import("leaflet"),
  cells: GlobalGridCell[],
  resolutionDeg: number,
) {
  const renderer = Leaflet.canvas({ padding: 0.5 });
  const half = resolutionDeg / 2;
  const layerGroup = Leaflet.layerGroup();
  cells.forEach((cell) => {
    Leaflet.rectangle(
      [
        [cell.lat - half, cell.lng - half],
        [cell.lat + half, cell.lng + half],
      ],
      {
        renderer,
        interactive: false,
        stroke: false,
        fillColor: colorForDelta(cell.delta),
        fillOpacity: 0.55,
      },
    ).addTo(layerGroup);
  });
  return layerGroup;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("de-DE", { month: "short" }).format(
    new Date(2000, i, 1),
  ),
);

export type MapMode = "local" | "global";

const CLICK_DETAIL_MODES: MapMode[] = ["local", "global"];

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

type LocalTab = "verlauf" | "extremwetter";

interface LocalSession {
  place: FieldState<string>;
  temperature: FieldState<string>;
  history: FieldState<HistoryInfo>;
  // null until the Extremwetter tab is opened for the first time — the
  // baseline fetch behind it can cost dozens of archive API calls on a cold
  // cache, so it's only triggered on demand, not on every map click.
  extremes: FieldState<ExtremesInfo> | null;
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
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [lastLatLng, setLastLatLng] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [globalGrid, setGlobalGrid] = useState<FieldState<GlobalGridResult> | null>(
    null,
  );
  const [globalGridProgress, setGlobalGridProgress] =
    useState<GlobalGridProgress | null>(null);
  const globalGridRequestedRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const requestIdRef = useRef(0);
  const historyFetchIdRef = useRef(0);
  const extremesFetchIdRef = useRef(0);
  const [activeTab, setActiveTab] = useState<LocalTab>("verlauf");

  const triggerGlobalGridFetch = () => {
    if (globalGridRequestedRef.current) return;
    globalGridRequestedRef.current = true;
    setGlobalGrid({ status: "loading" });
    const { year1, year2 } = defaultYears();
    fetchGlobalGrid(year1, year2, GLOBAL_RESOLUTION).then(
      (value) => setGlobalGrid({ status: "done", value }),
      () => setGlobalGrid({ status: "error" }),
    );
  };

  const loadHistory = (lat: number, lng: number, year1: number, year2: number) => {
    const locationRequestId = requestIdRef.current;
    const fetchId = ++historyFetchIdRef.current;
    const isStale = () =>
      requestIdRef.current !== locationRequestId ||
      historyFetchIdRef.current !== fetchId;

    setSession((s) => s && { ...s, history: { status: "loading" } });

    fetchHistory(lat, lng, year1, year2).then(
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
  };

  const loadExtremes = (lat: number, lng: number, year: number) => {
    const locationRequestId = requestIdRef.current;
    const fetchId = ++extremesFetchIdRef.current;
    const isStale = () =>
      requestIdRef.current !== locationRequestId ||
      extremesFetchIdRef.current !== fetchId;

    setSession((s) => s && { ...s, extremes: { status: "loading" } });

    fetchExtremeDays(lat, lng, year).then(
      (value) => {
        if (isStale()) return;
        setSession((s) => s && { ...s, extremes: { status: "done", value } });
      },
      (error) => {
        if (isStale()) return;
        console.error("extremes fetch failed:", error);
        setSession((s) => s && { ...s, extremes: { status: "error" } });
      },
    );
  };

  const handleSelectExtremesYear = (year: number) => {
    if (!lastLatLng) return;
    loadExtremes(lastLatLng.lat, lastLatLng.lng, year);
  };

  const handleSelectPastYear = (year: number) => {
    if (!lastLatLng || session?.history.status !== "done") return;
    loadHistory(
      lastLatLng.lat,
      lastLatLng.lng,
      year,
      session.history.value.recentYear,
    );
  };

  const handleSelectRecentYear = (year: number) => {
    if (!lastLatLng || session?.history.status !== "done") return;
    loadHistory(
      lastLatLng.lat,
      lastLatLng.lng,
      session.history.value.pastYear,
      year,
    );
  };

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
        if (!modeRef.current || !CLICK_DETAIL_MODES.includes(modeRef.current)) {
          return;
        }
        const { lat, lng } = e.latlng;
        const requestId = ++requestIdRef.current;
        const isStale = () => requestIdRef.current !== requestId;

        setLastLatLng({ lat, lng });
        setActiveTab("verlauf");
        setSession({
          place: { status: "loading" },
          temperature: { status: "loading" },
          history: { status: "loading" },
          extremes: null,
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

        const { year1, year2 } = defaultYears();
        loadHistory(lat, lng, year1, year2);
      });
      mapRef.current = map;
      leafletRef.current = L;
      setMapReady(true);
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

  // Fires once per session, not once per mode switch — toggling Local <->
  // Global repeatedly reuses whatever was already fetched instead of
  // re-hitting the backend (a cold grid request can take a while).
  useEffect(() => {
    if (!mapReady || mode !== "global") return;
    triggerGlobalGridFetch();
  }, [mode, mapReady]);

  // Polls a lightweight progress endpoint while the grid is loading, so a
  // long cold-cache request shows real, moving numbers instead of a static
  // "please wait" message that's indistinguishable from a stuck request.
  useEffect(() => {
    if (globalGrid?.status !== "loading") return;
    const { year1, year2 } = defaultYears();
    let cancelled = false;

    const poll = () => {
      fetchGlobalGridProgress(year1, year2, GLOBAL_RESOLUTION).then((value) => {
        if (!cancelled) setGlobalGridProgress(value);
      }, () => {});
    };
    poll();
    const interval = setInterval(poll, PROGRESS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [globalGrid?.status]);

  // Extreme-day counts are only fetched once the Extremwetter tab is
  // actually opened — a cold-cache baseline lookup can cost dozens of
  // archive API calls, so it shouldn't fire on every map click.
  useEffect(() => {
    if (activeTab !== "extremwetter" || !lastLatLng || !session) return;
    if (session.extremes !== null) return;
    loadExtremes(lastLatLng.lat, lastLatLng.lng, new Date().getUTCFullYear() - 1);
  }, [activeTab, session, lastLatLng]);

  // Kept separate from the fetch-triggering effect so the layer's
  // presence tracks `mode` independent of whether a fetch is in flight,
  // already done, or was already cached from an earlier mode toggle.
  useEffect(() => {
    const map = mapRef.current;
    const Leaflet = leafletRef.current;
    if (!map || !Leaflet) return;
    if (mode === "global" && globalGrid?.status === "done") {
      const layer = buildGridLayer(Leaflet, globalGrid.value.cells, GLOBAL_RESOLUTION);
      layer.addTo(map);
      gridLayerRef.current = layer;
      return () => {
        layer.remove();
        gridLayerRef.current = null;
      };
    }
  }, [mode, globalGrid]);

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
      {mode === "global" && globalGrid?.status === "loading" && (
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
            width: 240,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            Lade globale Temperaturanomalien
            {globalGridProgress
              ? ` (${Math.min(100, Math.round((globalGridProgress.done / globalGridProgress.total) * 100))}%)`
              : "…"}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "var(--border, #2a2d36)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${
                  globalGridProgress
                    ? Math.min(
                        100,
                        (globalGridProgress.done / globalGridProgress.total) * 100,
                      )
                    : 4
                }%`,
                background: "var(--accent-bright, #2dd4bf)",
                transition: "width 0.6s ease",
              }}
            />
          </div>
          {globalGridProgress && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              {globalGridProgress.done} / {globalGridProgress.total} Punkte
            </div>
          )}
        </div>
      )}
      {mode === "global" && globalGrid?.status === "error" && (
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
            maxWidth: 240,
          }}
        >
          <p style={{ marginBottom: 8 }}>Laden fehlgeschlagen.</p>
          <button
            type="button"
            onClick={() => {
              globalGridRequestedRef.current = false;
              triggerGlobalGridFetch();
            }}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              background: "var(--accent, #0f766e)",
              color: "#fff",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )}
      {mode === "global" && globalGrid?.status === "done" && (
        <GlobalAnomalyLegend unit={globalGrid.value.unit} />
      )}
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
        <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
          <TabButton
            label="Verlauf"
            active={activeTab === "verlauf"}
            onClick={() => setActiveTab("verlauf")}
          />
          <TabButton
            label="Extremwetter"
            active={activeTab === "extremwetter"}
            onClick={() => setActiveTab("extremwetter")}
          />
        </div>
        {activeTab === "verlauf" ? (
          <div>
            {session?.history.status === "done" ? (
              <HistoryContent
                history={session.history.value}
                onSelectPastYear={handleSelectPastYear}
                onSelectRecentYear={handleSelectRecentYear}
              />
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
        ) : (
          <div>
            {session?.extremes?.status === "done" ? (
              <ExtremeWeatherPanel
                info={session.extremes.value}
                onSelectYear={handleSelectExtremesYear}
              />
            ) : session?.extremes?.status === "error" ? (
              <p>Extremwetter-Daten nicht verfügbar</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <Skeleton width="100%" height={46} />
                  <Skeleton width="100%" height={46} />
                  <Skeleton width="100%" height={46} />
                </div>
                <Skeleton width="100%" height={120} />
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

const TabButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      padding: "6px 12px",
      borderRadius: 999,
      border: "none",
      background: active ? "var(--accent, #0f766e)" : "rgba(255,255,255,0.04)",
      color: active ? "#fff" : "inherit",
      font: "inherit",
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

const HistoryContent = ({
  history,
  onSelectPastYear,
  onSelectRecentYear,
}: {
  history: HistoryInfo;
  onSelectPastYear: (year: number) => void;
  onSelectRecentYear: (year: number) => void;
}) => (
  <>
    <TemperatureChart
      pastYear={history.pastYear}
      recentYear={history.recentYear}
      pastMonthly={history.pastMonthly}
      recentMonthly={history.recentMonthly}
      unit={history.unit}
      onSelectPastYear={onSelectPastYear}
      onSelectRecentYear={onSelectRecentYear}
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
