"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { logout } from "../../../lib/auth";
import AuthGuard from "../../../components/AuthGuard";
import Link from "next/link";

interface Task {
  task_id: string;
  claim_id?: string;
  description: string;
  city: string;
  urgency_score: number;
  priority_score: number;
  status: string;
  contact_number?: string;
  assigned_volunteer_ids?: string[];
  volunteer_details?: VolunteerDetail[];
  is_emergency?: boolean;
  latitude: number;
  longitude: number;
}

interface VolunteerDetail {
  volunteer_id: string;
  name: string;
  email: string;
  skills: string[];
  rating: number;
  availability: boolean;
}

interface Analytics {
  total_accepted: string;
  in_progress: string;
  completed: string;
  volunteers_assigned: string;
  avg_completion_hours: string | null;
}

interface Volunteer {
  volunteer_id: string;
  name: string;
  email: string;
  skills: string[];
  rating: number;
  availability: boolean;
  tasks_completed: string;
  tasks_active: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:            "bg-gray-100 text-gray-600",
  sent_to_ngo:        "bg-yellow-100 text-yellow-800",
  accepted_by_ngo:    "bg-blue-100 text-blue-800",
  volunteers_assigned:"bg-purple-100 text-purple-800",
  in_progress:        "bg-orange-100 text-orange-800",
  completed:          "bg-green-100 text-green-800",
};

const SKILL_COLORS: Record<string, string> = {
  food:      "bg-orange-100 text-orange-700",
  medical:   "bg-red-100 text-red-700",
  shelter:   "bg-blue-100 text-blue-700",
  education: "bg-purple-100 text-purple-700",
  water:     "bg-cyan-100 text-cyan-700",
};

export default function NGODashboard() {
  const [tab, setTab] = useState<"incoming" | "accepted" | "volunteers" | "analytics">("incoming");
  const [incoming, setIncoming] = useState<Task[]>([]);
  const [accepted, setAccepted] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [inc, acc, vols, ana] = await Promise.all([
        api.get("/api/ngo-claims/ngo/tasks/incoming").then((r) => r.data),
        api.get("/api/ngo-claims/ngo/tasks/accepted").then((r) => r.data),
        api.get("/api/ngo-claims/ngo/volunteers").then((r) => r.data),
        api.get("/api/ngo-claims/ngo/analytics").then((r) => r.data),
      ]);
      setIncoming(inc);
      setAccepted(acc);
      setVolunteers(vols);
      setAnalytics(ana);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function respond(claimId: string, response: "accepted" | "rejected") {
    setResponding(claimId);
    try {
      await api.post(`/api/ngo-claims/${claimId}/respond`, { response });
      await loadAll();
    } catch (e) { console.error(e); }
    setResponding(null);
  }

  const tabs = [
    { id: "incoming",   label: `📥 Incoming`,   badge: incoming.length },
    { id: "accepted",   label: `✅ Accepted`,    badge: accepted.length },
    { id: "volunteers", label: `👥 Volunteers`,  badge: volunteers.length },
    { id: "analytics",  label: `📊 Analytics`,   badge: null },
  ] as const;

  return (
    <AuthGuard requiredRole="ngo_admin">
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">NGO Dashboard</h1>
          <p className="text-xs text-gray-500">Manage incoming tasks and your volunteer team</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/ngo/volunteers"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
            + Add Volunteer
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">Home</Link>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5
              ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
            {t.badge !== null && t.badge > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold
                ${tab === t.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-6xl mx-auto">
        {loading && <div className="text-center text-gray-400 py-16 text-lg">Loading...</div>}

        {/* ── INCOMING TASKS ── */}
        {!loading && tab === "incoming" && (
          <div className="space-y-4">
            {incoming.length === 0 && (
              <div className="bg-white rounded-xl p-10 text-center text-gray-400">
                <p className="text-4xl mb-2">📭</p>
                <p>No incoming tasks right now</p>
                <p className="text-xs mt-1">Tasks will appear here when a public user submits a report matching your NGO's skills</p>
              </div>
            )}
            {incoming.map((t) => (
              <div key={t.task_id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {t.is_emergency && (
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                          🚨 EMERGENCY
                        </span>
                      )}
                      <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{t.task_id}</span>
                    </div>
                    <p className="text-gray-800 font-semibold text-base mb-2">{t.description}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>📍 {t.city || "Unknown location"}</span>
                      <span>🔥 Urgency: <strong>{t.urgency_score?.toFixed(2)}</strong></span>
                      <span>⭐ Priority: <strong>{t.priority_score?.toFixed(2)}/10</strong></span>
                      {t.contact_number && <span>📞 {t.contact_number}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => respond(t.claim_id!, "accepted")}
                      disabled={responding === t.claim_id}
                      className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                      ✓ Accept
                    </button>
                    <button onClick={() => respond(t.claim_id!, "rejected")}
                      disabled={responding === t.claim_id}
                      className="bg-red-50 text-red-600 border border-red-200 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ACCEPTED TASKS ── */}
        {!loading && tab === "accepted" && (
          <div className="space-y-4">
            {accepted.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center text-gray-400">
                <p className="text-4xl mb-2">📋</p>
                <p>No accepted tasks yet</p>
              </div>
            ) : accepted.map((t) => (
              <div key={t.task_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Task header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {t.is_emergency && (
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">🚨 EMERGENCY</span>
                        )}
                        <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{t.task_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-800">{t.description}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        <span>📍 {t.city}</span>
                        <span>⭐ Priority: <strong>{t.priority_score?.toFixed(2)}</strong></span>
                        {t.contact_number && <span>📞 {t.contact_number}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned volunteers */}
                <div className="p-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Assigned Volunteers ({t.volunteer_details?.length ?? 0})
                  </p>
                  {(!t.volunteer_details || t.volunteer_details.length === 0) ? (
                    <p className="text-sm text-gray-400 italic">No volunteers assigned yet</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {t.volunteer_details.map((v) => (
                        <div key={v.volunteer_id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                            {v.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{v.name}</p>
                            <p className="text-xs text-gray-400 truncate">{v.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {v.skills?.map((s) => (
                                <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${SKILL_COLORS[s] ?? "bg-gray-100 text-gray-600"}`}>
                                  {s}
                                </span>
                              ))}
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${v.availability ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {v.availability ? "● Active" : "○ Busy"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">⭐ {Number(v.rating).toFixed(1)} rating</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VOLUNTEERS ── */}
        {!loading && tab === "volunteers" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{volunteers.length} volunteer{volunteers.length !== 1 ? "s" : ""} in your NGO</p>
              <Link href="/ngo/volunteers"
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                + Add Volunteer
              </Link>
            </div>

            {volunteers.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center text-gray-400">
                <p className="text-4xl mb-2">👥</p>
                <p>No volunteers yet</p>
                <Link href="/ngo/volunteers" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                  Add your first volunteer →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {volunteers.map((v) => (
                  <div key={v.volunteer_id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{v.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{v.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${v.availability ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {v.availability ? "● Available" : "○ Busy"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {v.skills?.map((s) => (
                        <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SKILL_COLORS[s] ?? "bg-gray-100 text-gray-600"}`}>
                          {s}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="font-bold text-gray-700 text-base">{"⭐".repeat(Math.round(v.rating))}</p>
                        <p className="text-gray-400">{Number(v.rating).toFixed(1)} rating</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="font-bold text-green-700 text-lg">{v.tasks_completed}</p>
                        <p className="text-gray-400">Completed</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="font-bold text-blue-700 text-lg">{v.tasks_active}</p>
                        <p className="text-gray-400">Active</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-2 font-mono">{v.volunteer_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {!loading && tab === "analytics" && analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Accepted",       value: analytics.total_accepted,       color: "text-blue-600",   bg: "bg-blue-50" },
                { label: "Volunteers Assigned",  value: analytics.volunteers_assigned,  color: "text-purple-600", bg: "bg-purple-50" },
                { label: "In Progress",          value: analytics.in_progress,          color: "text-orange-600", bg: "bg-orange-50" },
                { label: "Completed",            value: analytics.completed,            color: "text-green-600",  bg: "bg-green-50" },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-5 text-center`}>
                  <p className={`text-4xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {analytics.avg_completion_hours && (
              <div className="bg-white rounded-xl p-5 text-center shadow-sm">
                <p className="text-3xl font-bold text-gray-700">{Number(analytics.avg_completion_hours).toFixed(1)}h</p>
                <p className="text-sm text-gray-500 mt-1">Average Completion Time</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
    </AuthGuard>
  );
}
