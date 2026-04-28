"use client";
import { useEffect, useState } from "react";
import { tasksApi } from "../lib/api";

interface Task {
  task_id: string;
  report_id: string;
  status: string;
  priority_score: number;
  assigned_volunteer_ids: string[];
  latitude: number;
  longitude: number;
  created_at: string;
}

export default function TaskStatusCounts() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("all");

  async function load() {
    const data = await tasksApi.list();
    setTasks(data as Task[]);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const counts = {
    pending:     tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed:   tasks.filter((t) => t.status === "completed").length,
  };

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const sorted = [...filtered].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

  const statusStyle: Record<string, string> = {
    pending:     "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed:   "bg-green-100 text-green-800",
    cancelled:   "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending",     value: counts.pending,     color: "bg-yellow-50 border-yellow-200 text-yellow-700", id: "pending" },
          { label: "In Progress", value: counts.in_progress, color: "bg-blue-50 border-blue-200 text-blue-700",       id: "in_progress" },
          { label: "Completed",   value: counts.completed,   color: "bg-green-50 border-green-200 text-green-700",    id: "completed" },
        ].map((c) => (
          <button key={c.id} onClick={() => setFilter(filter === c.id ? "all" : c.id)}
            className={`rounded-lg p-4 border-2 text-left transition-all ${c.color} ${filter === c.id ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}>
            <p className="text-sm font-medium">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left sticky top-0">
              <th className="p-3 border-b font-semibold text-gray-600">Task ID</th>
              <th className="p-3 border-b font-semibold text-gray-600">Report</th>
              <th className="p-3 border-b font-semibold text-gray-600">Status</th>
              <th className="p-3 border-b font-semibold text-gray-600 text-right">Priority</th>
              <th className="p-3 border-b font-semibold text-gray-600">Assigned To</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((t) => (
              <tr key={t.task_id} className="hover:bg-gray-50 border-b">
                <td className="p-3 font-mono text-xs text-gray-500">{t.task_id}</td>
                <td className="p-3 font-mono text-xs text-gray-500">{t.report_id}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[t.status] ?? "bg-gray-100"}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-3 text-right font-semibold">{t.priority_score?.toFixed(2) ?? "—"}</td>
                <td className="p-3 text-xs text-gray-600">
                  {t.assigned_volunteer_ids?.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 50 && (
          <p className="text-center text-xs text-gray-400 py-2">Showing 50 of {sorted.length}</p>
        )}
      </div>
    </div>
  );
}
