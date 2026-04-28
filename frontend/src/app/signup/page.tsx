"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", role: "public_user", ngo_id: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/api/auth/signup", {
        email: form.email,
        password: form.password,
        role: form.role,
        ngo_id: form.role === "ngo_admin" && form.ngo_id ? form.ngo_id : undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Account created!</h2>
          <p className="text-gray-500 text-sm mb-4">You can now sign in.</p>
          <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const NGO_OPTIONS = [
    "NGO1","NGO2","NGO3","NGO4","NGO5","NGO6","NGO7","NGO8","NGO9","NGO10",
    "NGO11","NGO12","NGO13","NGO14","NGO15","NGO16","NGO17","NGO18","NGO19","NGO20",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">Join the volunteer coordination platform</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={6} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="public_user">Public User (submit reports)</option>
              <option value="ngo_admin">NGO Admin (manage tasks & volunteers)</option>
            </select>
          </div>
          {form.role === "ngo_admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NGO</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.ngo_id} onChange={(e) => setForm((f) => ({ ...f, ngo_id: e.target.value }))}>
                <option value="">Select your NGO</option>
                {NGO_OPTIONS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
