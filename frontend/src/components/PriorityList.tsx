"use client";
import { useEffect, useState } from "react";
import { reportsApi } from "../lib/api";

interface Report {
  report_id: string;
  need_type: string;
  urgency_score: number;
  people_affected: number;
  priority_score: number;
  raw_text: string;
  submitted_at: string;
  latitude: number;
  longitude: number;
}

const TYPE_COLORS: Record<string, string> = {
  food:      "bg-orange-100 text-orange-800",
  medical:   "bg-red-100 text-red-800",
  shelter:   "bg-blue-100 text-blue-800",
  education: "bg-purple-100 text-purple-800",
  water:     "bg-cyan-100 text-cyan-800",
};

function PriorityBar({ score }: { score: number }) {
  const pct = Math.min((score / 10) * 100, 100);
  const color = score >= 7 ? "bg-red-500" : score >= 4 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{score?.toFixed(1)}</span>
    </div>
  );
}

export default function PriorityList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState({ need_type: "", min_priority: "" });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    reportsApi.list().then((d: Report[]) => setReports(d)).catch(console.error);
  }, []);

  const filtered = reports
    .filter((r) => {
      if (filter.need_type && r.need_type !== filter.need_type) return false;
      if (filter.min_priority && (r.priority_score ?? 0) < parseFloat(filter.min_priority)) return false;
      return true;
    })
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filter.need_type}
          onChange={(e) => { setFilter((f) => ({ ...f, need_type: e.target.value })); setPage(0); }}
        >
          <option value="">All types</option>
          {["food","medical","shelter","education","water"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filter.min_priority}
          onChange={(e) => { setFilter((f) => ({ ...f, min_priority: e.target.value })); setPage(0); }}
        >
          <option value="">All priorities</option>
          <option value="7">High only (≥7)</option>
          <option value="4">Medium+ (≥4)</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} reports</span>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-3 border-b font-semibold text-gray-600">Report</th>
              <th className="p-3 border-b font-semibold text-gray-600">Type</th>
              <th className="p-3 border-b font-semibold text-gray-600">Description</th>
              <th className="p-3 border-b font-semibold text-gray-600 text-right">People</th>
              <th className="p-3 border-b font-semibold text-gray-600 w-40">Priority</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.report_id} className="hover:bg-gray-50 border-b">
                <td className="p-3 font-mono text-xs text-gray-500">{r.report_id}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[r.need_type] ?? "bg-gray-100 text-gray-700"}`}>
                    {r.need_type ?? "—"}
                  </span>
                </td>
                <td className="p-3 text-gray-700 max-w-xs truncate" title={r.raw_text}>
                  {r.raw_text}
                </td>
                <td className="p-3 text-right font-medium">{r.people_affected ?? "—"}</td>
                <td className="p-3">
                  <PriorityBar score={r.priority_score ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
