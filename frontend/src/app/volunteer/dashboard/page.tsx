"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "../../../lib/api";
import { logout } from "../../../lib/auth";
import AuthGuard from "../../../components/AuthGuard";
import FeedbackForm from "../../../components/FeedbackForm";
import Link from "next/link";

const VolunteerMapView = dynamic(() => import("../../../components/VolunteerMapView"), { ssr: false });

interface Task {
  task_id: string;
  report_id?: string;
  description?: string;
  raw_text?: string;
  city?: string;
  status: string;
  priority_score: number;
  urgency_score?: number;
  required_skills?: string[];
  latitude: number;
  longitude: number;
  contact_number?: string;
  is_emergency?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  volunteers_assigned: "bg-purple-100 text-purple-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

export default function VolunteerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [tab, setTab] = useState<"list" | "map">("list");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await api.get("/api/tasks/volunteer/tasks");
      setTasks(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function updateStatus(taskId: string, status: string) {
    setActing(true);
    try {
      await api.put(`/api/tasks/${taskId}/status`, { status });
      await loadTasks();
      if (status === "completed") setShowFeedback(true);
      else setSelected(null);
    } catch (e) { console.error(e); }
    setActing(false);
  }

  const text = (t: Task) => t.description || t.raw_text || "No description";

  return (
    <AuthGuard requiredRole="volunteer">
      <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">My Tasks</h1>
          <p className="text-xs text-gray-500">{tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b px-6">
        {(["list", "map"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 mr-2 capitalize transition-colors
              ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "list" ? "📋 Task List" : "🗺️ Map View"}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-4xl mx-auto">
        {loading && <div className="text-center text-gray-400 py-12">Loading tasks...</div>}

        {/* Task detail panel */}
        {selected && !showFeedback && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <button onClick={() => setSelected(null)} className="text-blue-600 text-sm mb-4 hover:underline">← Back</button>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {selected.is_emergency && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">🚨 EMERGENCY</span>}
                  <span className="font-mono text-xs text-gray-400">{selected.task_id}</span>
                </div>
                <p className="text-gray-800 font-medium text-lg">{text(selected)}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[selected.status] ?? "bg-gray-100"}`}>
                {selected.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-6">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Location</p>
                <p className="font-medium">{selected.city || `${selected.latitude?.toFixed(3)}, ${selected.longitude?.toFixed(3)}`}</p>
                <a href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=15/${selected.latitude}/${selected.longitude}`}
                  target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open in Maps →</a>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Priority Score</p>
                <p className="font-bold text-lg">{selected.priority_score?.toFixed(2)} / 10</p>
              </div>
              {selected.contact_number && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="font-medium">📞 {selected.contact_number}</p>
                </div>
              )}
              {selected.required_skills && selected.required_skills.length > 0 && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Skills needed</p>
                  <p className="font-medium capitalize">{selected.required_skills.join(", ")}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {selected.status === "volunteers_assigned" && (
                <button onClick={() => updateStatus(selected.task_id, "in_progress")} disabled={acting}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  ✓ Accept & Start
                </button>
              )}
              {selected.status === "in_progress" && (
                <button onClick={() => updateStatus(selected.task_id, "completed")} disabled={acting}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  ✅ Mark Complete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback form */}
        {selected && showFeedback && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Submit Feedback</h3>
            <FeedbackForm
              taskId={selected.task_id}
              volunteerId=""
              reportId={selected.report_id || selected.task_id}
              onSubmitted={() => { setShowFeedback(false); setSelected(null); loadTasks(); }}
            />
          </div>
        )}

        {/* Task list */}
        {!loading && tab === "list" && !selected && (
          <div className="space-y-3">
            {tasks.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400">No tasks assigned yet</div>
            )}
            {tasks.map((t) => (
              <div key={t.task_id} onClick={() => { setSelected(t); setShowFeedback(false); }}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {t.is_emergency && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">🚨</span>}
                    <span className="font-medium text-gray-800 truncate max-w-xs">{text(t)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_COLORS[t.status] ?? "bg-gray-100"}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>📍 {t.city || "Unknown"}</span>
                  <span>⭐ Priority: {t.priority_score?.toFixed(2)}</span>
                  {t.required_skills?.[0] && <span>🔧 {t.required_skills[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Map view */}
        {!loading && tab === "map" && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <VolunteerMapView tasks={tasks} onTaskClick={(t) => { setSelected(t); setTab("list"); }} />
          </div>
        )}
      </main>
    </div>
    </AuthGuard>
  );
}
