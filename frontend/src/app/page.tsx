"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { getRole, isAuthenticated, logout } from "../lib/auth";

const CITIES = [
  "Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata",
  "Pune","Ahmedabad","Jaipur","Lucknow","Patna","Bhopal",
  "Nagpur","Kochi","Guwahati","Chandigarh","Surat","Indore","Coimbatore","Kanpur",
];

const EXAMPLES = [
  "50 people starving, no food for 3 days",
  "Medical emergency — 30 injured, need doctors urgently",
  "100 families homeless after flood, need shelter",
  "School destroyed, 200 students affected",
  "No clean drinking water for 5 days",
];

interface SubmitResult {
  task_id: string;
  need_type: string;
  urgency_score: number;
  priority_score: number;
  is_emergency: boolean;
  is_duplicate: boolean;
  duplicate_of?: string;
  status: string;
  assigned_volunteers: string[];
  ngos_notified: { ngo_id: string; name: string; distance_km: number }[];
}

export default function Home() {
  const [form, setForm] = useState({ description: "", city: "Mumbai", contact_number: "", people_affected: "20" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");

  const loggedIn = isAuthenticated();
  const role = getRole();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError("");
    try {
      const res = await api.post("/api/tasks/submit", {
        description: form.description,
        city: form.city,
        contact_number: form.contact_number || undefined,
        people_affected: parseInt(form.people_affected) || 20,
      });
      setResult(res.data);
      setForm((f) => ({ ...f, description: "", contact_number: "" }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      {/* ── Header ── */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Volunteer Coordination Platform</h1>
              <p className="text-xs text-gray-400">Smart Resource Allocation for NGOs — India</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <>
                <Link
                  href={role === "ngo_admin" ? "/ngo/dashboard" : role === "volunteer" ? "/volunteer/dashboard" : "/admin"}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {role === "ngo_admin" ? "NGO Dashboard" : role === "volunteer" ? "My Tasks" : "Dashboard"} →
                </Link>
                <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800 font-medium px-3 py-2">Login</Link>
                <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-gray-800 mb-3">Report a Community Need</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Describe the problem. Our AI reads it, scores urgency, finds the nearest NGO, and assigns volunteers — automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Submit Form (left, wider) ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-700 mb-4 text-lg">Submit a Report</h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Describe the problem *</label>
                  <textarea
                    required
                    className="w-full border rounded-xl px-4 py-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g. 50 families displaced by flood, need food and shelter urgently. Children and elderly affected."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} type="button"
                        onClick={() => setForm((f) => ({ ...f, description: ex }))}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {ex.slice(0, 38)}…
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <select
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    >
                      {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">People affected</label>
                    <input
                      type="number" min="1"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={form.people_affected}
                      onChange={(e) => setForm((f) => ({ ...f, people_affected: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact number (optional)</label>
                  <input
                    type="tel"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="+91 98765 43210"
                    value={form.contact_number}
                    onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.description.trim()}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {submitting ? "⏳ AI is processing your report…" : "🚀 Submit Report"}
                </button>
              </form>

              {/* Result */}
              {result && (
                <div className={`mt-5 rounded-xl p-4 border ${result.is_emergency ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`font-semibold mb-3 ${result.is_emergency ? "text-red-800" : "text-green-800"}`}>
                    {result.is_emergency ? "🚨 EMERGENCY — Volunteers assigned directly!" : "✅ Report submitted!"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["Task ID", result.task_id],
                      ["AI detected", result.need_type || "processing…"],
                      ["Urgency", `${result.urgency_score?.toFixed(2)} / 1.0`],
                      ["Priority", `${result.priority_score?.toFixed(2)} / 10`],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-semibold text-gray-800 capitalize">{val}</p>
                      </div>
                    ))}
                  </div>

                  {result.is_duplicate && (
                    <p className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded p-2">
                      ⚠️ Similar report already exists ({result.duplicate_of}). Flagged as possible duplicate.
                    </p>
                  )}

                  {result.ngos_notified?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">NGOs notified:</p>
                      {result.ngos_notified.map((n) => (
                        <p key={n.ngo_id} className="text-xs text-gray-600 bg-white rounded px-2 py-1 mb-1">
                          🏢 {n.name} — {n.distance_km.toFixed(0)} km away
                        </p>
                      ))}
                    </div>
                  )}

                  {result.assigned_volunteers?.length > 0 && (
                    <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
                      👥 Volunteers assigned: <span className="font-mono font-bold">{result.assigned_volunteers.join(", ")}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* How it works */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-3">How it works</h3>
              <div className="space-y-3">
                {[
                  { icon: "🤖", title: "AI reads your report", desc: "Detects need type, urgency score, and priority" },
                  { icon: "🏢", title: "NGO gets notified", desc: "Nearest registered NGO with matching skills receives the task" },
                  { icon: "✅", title: "NGO accepts", desc: "First NGO to accept claims the task" },
                  { icon: "🙋", title: "Volunteer assigned", desc: "Best-matched volunteer is dispatched automatically" },
                ].map((s) => (
                  <div key={s.title} className="flex gap-3">
                    <span className="text-xl shrink-0">{s.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{s.title}</p>
                      <p className="text-xs text-gray-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Role links */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-3">Dashboards</h3>
              <div className="space-y-2">
                <Link href="/ngo/dashboard"
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                  <span className="text-sm font-medium text-blue-700">🏢 NGO Dashboard</span>
                  <span className="text-xs text-blue-400">Accept tasks →</span>
                </Link>
                <Link href="/volunteer/dashboard"
                  className="flex items-center justify-between p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                  <span className="text-sm font-medium text-green-700">🙋 Volunteer Dashboard</span>
                  <span className="text-xs text-green-400">View tasks →</span>
                </Link>
                <Link href="/admin"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-sm font-medium text-gray-700">📊 Admin Overview</span>
                  <span className="text-xs text-gray-400">All reports →</span>
                </Link>
              </div>
            </div>

            {/* Demo credentials */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-3">Demo Accounts</h3>
              <div className="space-y-2 text-xs">
                {[
                  { role: "NGO Admin", email: "ngo1_admin@example.com", pass: "demo123", color: "text-blue-700 bg-blue-50" },
                  { role: "NGO Admin", email: "ngo2_admin@example.com", pass: "demo123", color: "text-blue-700 bg-blue-50" },
                  { role: "Volunteer", email: "vol1@ngo1.com", pass: "demo123", color: "text-green-700 bg-green-50" },
                  { role: "Volunteer", email: "vol1@ngo2.com", pass: "demo123", color: "text-green-700 bg-green-50" },
                ].map((d) => (
                  <div key={d.email} className={`rounded-lg px-3 py-2 ${d.color}`}>
                    <span className="font-semibold">{d.role}:</span> {d.email} / {d.pass}
                  </div>
                ))}
                <Link href="/login" className="block text-center text-blue-600 hover:underline pt-1">Login →</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
