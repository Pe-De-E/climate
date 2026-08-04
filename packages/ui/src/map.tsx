"use client";

import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const reverseGeocode = async (lat: number, lng: number) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.display_name as string | undefined;
};

interface MapProps {
  className?: string;
  /** [latitude, longitude] */
  center?: [number, number];
  zoom?: number;
  onMapLoad?: (map: L.Map) => void;
}

export const Map = ({
  className,
  center = [0, 0],
  zoom = 2,
  onMapLoad,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView(center, zoom);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        console.log(`lat: ${lat}, lng: ${lng}`);
        try {
          const placeName = await reverseGeocode(lat, lng);
          console.log(`place: ${placeName ?? "unbekannt"}`);
        } catch {
          console.log("place: Geocoding fehlgeschlagen");
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
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
