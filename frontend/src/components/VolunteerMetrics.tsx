"use client";
import { useEffect, useState } from "react";
import { feedbackApi } from "../lib/api";

interface Metric {
  volunteer_id: string;
  total_feedback: number;
  avg_difficulty: number;
  completed_count: number;
  failed_count: number;
}

export default function VolunteerMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    feedbackApi.metrics().then(setMetrics).catch(console.error);
  }, []);

  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2 border">Volunteer</th>
            <th className="text-right p-2 border">Completed</th>
            <th className="text-right p-2 border">Failed</th>
            <th className="text-right p-2 border">Avg Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {metrics.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-gray-400">No feedback data yet</td></tr>
          )}
          {metrics.map((m) => (
            <tr key={m.volunteer_id} className="hover:bg-gray-50">
              <td className="p-2 border font-mono text-xs">{m.volunteer_id}</td>
              <td className="p-2 border text-right text-green-700 font-semibold">{m.completed_count}</td>
              <td className="p-2 border text-right text-red-600">{m.failed_count}</td>
              <td className="p-2 border text-right">{Number(m.avg_difficulty).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
