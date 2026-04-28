"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const CITIES = [
  "Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata",
  "Pune","Ahmedabad","Jaipur","Lucknow","Patna","Bhopal",
  "Nagpur","Kochi","Guwahati","Chandigarh","Surat","Indore","Coimbatore","Kanpur",
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

export default function SubmitPage() {
  const [form, setForm] = useState({
    description: "",
    city: "Mumbai",
    contact_number: "",
    people_affected: "20",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");

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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const EXAMPLES = [
    "50 people starving, no food for 3 days in the area",
    "Medical emergency — 30 people injured, need doctors urgently",
    "100 families homeless after flood, need shelter immediately",
    "School destroyed, 200 students have no place to study",
    "No clean drinking water for 5 days, people getting sick",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Submit Community Report</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Home</Link>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-6">
            Describe the community need. Our AI will automatically detect the type, urgency, and route it to the nearest NGO.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Describe the problem *</label>
              <textarea required
                className="w-full border rounded-lg px-3 py-2 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="e.g. 50 families displaced by flood, need food and shelter urgently..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setForm((f) => ({ ...f, description: ex }))}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded">
                    {ex.slice(0, 35)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">People affected</label>
                <input type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.people_affected} onChange={(e) => setForm((f) => ({ ...f, people_affected: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact number (optional)</label>
              <input type="tel" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="+91 98765 43210"
                value={form.contact_number} onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))} />
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

            <button type="submit" disabled={submitting || !form.description.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm">
              {submitting ? "⏳ AI is processing your report..." : "Submit Report"}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className="mt-6 space-y-4">
              <div className={`rounded-xl p-4 ${result.is_emergency ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                <p className={`font-semibold mb-3 ${result.is_emergency ? "text-red-800" : "text-green-800"}`}>
                  {result.is_emergency ? "🚨 EMERGENCY — Volunteers assigned directly!" : "✅ Report submitted successfully!"}
                </p>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-500">Task ID</p>
                    <p className="font-mono font-bold text-gray-800">{result.task_id}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-500">AI detected</p>
                    <p className="font-bold capitalize text-gray-800">{result.need_type || "processing..."}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-500">Urgency score</p>
                    <p className="font-bold text-gray-800">{result.urgency_score?.toFixed(2)} / 1.0</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-500">Priority score</p>
                    <p className="font-bold text-gray-800">{result.priority_score?.toFixed(2)} / 10</p>
                  </div>
                </div>

                {result.is_duplicate && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                    ⚠️ Similar report already exists: {result.duplicate_of}. Your report has been flagged as a possible duplicate.
                  </div>
                )}

                {result.ngos_notified?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">NGOs notified ({result.ngos_notified.length}):</p>
                    {result.ngos_notified.map((n) => (
                      <div key={n.ngo_id} className="text-xs text-gray-600 bg-white rounded px-2 py-1 mb-1">
                        {n.name} — {n.distance_km.toFixed(1)} km away
                      </div>
                    ))}
                  </div>
                )}

                {result.assigned_volunteers?.length > 0 && (
                  <div className="mt-3 bg-blue-50 rounded p-3 text-sm text-blue-700">
                    Volunteers assigned: <span className="font-mono font-bold">{result.assigned_volunteers.join(", ")}</span>
                  </div>
                )}
              </div>

              <Link href="/admin" className="block text-center text-sm text-blue-600 hover:underline">
                View on Admin Dashboard →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
