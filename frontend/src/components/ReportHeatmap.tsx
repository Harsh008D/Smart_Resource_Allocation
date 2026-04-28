"use client";
/**
 * ReportHeatmap — renders active reports as circle markers on a Leaflet map.
 * Color scale: green (low priority) → yellow → red (high priority).
 * Leaflet is loaded client-side only (no SSR).
 */
import { useEffect, useRef } from "react";

interface Report {
  report_id: string;
  latitude: number;
  longitude: number;
  priority_score: number;
  need_type: string;
}

interface Props { reports: Report[] }

function priorityColor(score: number): string {
  if (score >= 7) return "#ef4444";   // red
  if (score >= 4) return "#f59e0b";   // amber
  return "#22c55e";                   // green
}

export default function ReportHeatmap({ reports }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (mapInstance.current) return;

      const map = L.map(mapRef.current!).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      mapInstance.current = map;

      for (const r of reports) {
        L.circleMarker([r.latitude, r.longitude], {
          radius: 8,
          fillColor: priorityColor(r.priority_score ?? 0),
          color: "#fff",
          weight: 1,
          fillOpacity: 0.8,
        })
          .bindPopup(`<b>${r.report_id}</b><br>Type: ${r.need_type ?? "—"}<br>Priority: ${r.priority_score?.toFixed(2) ?? "—"}`)
          .addTo(map);
      }
    });

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, [reports]);

  return <div ref={mapRef} style={{ height: "520px", width: "100%" }} />;
}
