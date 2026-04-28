"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../lib/api";
import { saveAuth } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/api/auth/login", form);
      const { token, role, user_id } = res.data;
      saveAuth(token, role, user_id);

      // Check if there's a saved redirect destination
      const redirect = sessionStorage.getItem("redirectAfterLogin");
      sessionStorage.removeItem("redirectAfterLogin");

      let dest = redirect || "/";
      if (!redirect) {
        if (role === "ngo_admin")  dest = "/ngo/dashboard";
        else if (role === "volunteer") dest = "/volunteer/dashboard";
        else dest = "/";
      }

      // Use Next.js router for reliable redirect
      router.replace(dest);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  const demos = [
    { label: "NGO Admin — Mumbai (food/medical)", email: "ngo1_admin@example.com", password: "demo123" },
    { label: "NGO Admin — Delhi (shelter/education)", email: "ngo2_admin@example.com", password: "demo123" },
    { label: "Volunteer — Rahul (food, Mumbai)", email: "vol1@ngo1.com", password: "demo123" },
    { label: "Volunteer — Priya (medical, Mumbai)", email: "vol2@ngo1.com", password: "demo123" },
    { label: "Volunteer — Vikram (shelter, Delhi)", email: "vol1@ngo2.com", password: "demo123" },
    { label: "Volunteer — Anita (education, Delhi)", email: "vol2@ngo2.com", password: "demo123" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-6">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">Welcome back</h1>
          <p className="text-sm text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" required autoFocus
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password" required
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-6 pt-5 border-t">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Demo accounts — click to fill
          </p>
          <div className="space-y-1.5">
            {demos.map((d) => (
              <button
                key={d.email}
                onClick={() => setForm({ email: d.email, password: d.password })}
                className="w-full text-left text-xs bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent rounded-lg px-3 py-2 text-gray-600 transition-colors"
              >
                <span className="font-semibold text-gray-700">{d.label}</span>
                <span className="text-gray-400 ml-1">— {d.email}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          No account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
