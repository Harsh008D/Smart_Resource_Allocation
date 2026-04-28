"use client";
import { useEffect, useRef } from "react";

interface Task {
  task_id: string;
  description?: string;
  raw_text?: string;
  latitude: number;
  longitude: number;
  priority_score: number;
  status: string;
  city?: string;
}

interface Props {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

function priorityColor(score: number): string {
  if (score >= 7) return "#ef4444";
  if (score >= 4) return "#f59e0b";
  return "#22c55e";
}

export default function VolunteerMapView({ tasks, onTaskClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || tasks.length === 0) return;

    import("leaflet").then((L) => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }

      const center = tasks[0];
      const map = L.map(mapRef.current!).setView([center.latitude, center.longitude], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      mapInstance.current = map;

      for (const t of tasks) {
        const marker = L.circleMarker([t.latitude, t.longitude], {
          radius: 12,
          fillColor: priorityColor(t.priority_score ?? 0),
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        });
        marker.bindPopup(
          `<b>${t.task_id}</b><br>${t.description || t.raw_text || ""}<br>
           Status: ${t.status}<br>Priority: ${t.priority_score?.toFixed(2)}`
        );
        if (onTaskClick) marker.on("click", () => onTaskClick(t));
        marker.addTo(map);
      }
    });

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, [tasks]);

  if (tasks.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No tasks to show on map</div>;
  }

  return <div ref={mapRef} style={{ height: "450px", width: "100%" }} />;
}
