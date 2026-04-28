"use client";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import AuthGuard from "../../../components/AuthGuard";
import Link from "next/link";

const CITIES = [
  { name: "Mumbai", lat: 18.9388, lon: 72.8354 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Bangalore", lat: 12.9716, lon: 77.5946 },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Pune", lat: 18.5204, lon: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714 },
];

export default function NGOVolunteersPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", skills: "food", city: "Mumbai" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ user_id: string; volunteer_id: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {}, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);
    try {
      const city = CITIES.find((c) => c.name === form.city) || CITIES[0];
      const res = await api.post("/api/auth/ngo/create-volunteer", {
        name: form.name,
        email: form.email,
        password: form.password,
        skills: [form.skills],
        latitude: city.lat + (Math.random() * 0.1 - 0.05),
        longitude: city.lon + (Math.random() * 0.1 - 0.05),
      });
      setSuccess(res.data);
      setForm({ name: "", email: "", password: "", skills: "food", city: "Mumbai" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Failed to create volunteer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard requiredRole="ngo_admin">
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Add Volunteer</h1>
        <Link href="/ngo/dashboard" className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
      </header>
      <main className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Create a volunteer under your NGO</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Full Name", key: "name", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: "Password", key: "password", type: "password" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input type={f.type} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={(form as Record<string, string>)[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Skill</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}>
                {["food", "medical", "shelter", "education", "water"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
                {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
            {success && (
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
                ✅ Volunteer created! ID: <span className="font-mono font-bold">{success.volunteer_id}</span>
                <br />They can log in with their email and password.
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Creating..." : "Create Volunteer"}
            </button>
          </form>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
