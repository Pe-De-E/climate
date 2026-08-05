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
        const [placeResult, temperatureResult] = await Promise.allSettled([
          reverseGeocode(lat, lng),
          fetchTemperature(lat, lng),
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
        });
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
      </Modal>
    </>
  );
};
