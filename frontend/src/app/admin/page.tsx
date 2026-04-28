"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import TaskStatusCounts from "../../components/TaskStatusCounts";
import PriorityList from "../../components/PriorityList";
import VolunteerMetrics from "../../components/VolunteerMetrics";
import { reportsApi, volunteersApi, tasksApi } from "../../lib/api";

const ReportHeatmap = dynamic(() => import("../../components/ReportHeatmap"), { ssr: false });

interface Report {
  report_id: string;
  latitude: number;
  longitude: number;
  priority_score: number;
  need_type: string;
  urgency_score: number;
  people_affected: number;
  raw_text: string;
}

export default function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ reports: 0, volunteers: 0, tasks: 0, available: 0 });
  const [activeTab, setActiveTab] = useState<"map" | "priority" | "tasks" | "volunteers">("map");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reps, vols, tasks] = await Promise.all([
          reportsApi.list(),
          volunteersApi.list(),
          tasksApi.list(),
        ]);
        setReports(reps);
        setStats({
          reports: reps.length,
          volunteers: vols.length,
          tasks: tasks.length,
          available: vols.filter((v: { availability: boolean }) => v.availability).length,
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const tabs = [
    { id: "map",        label: "🗺️ Needs Map" },
    { id: "priority",   label: "🔥 Priority Rankings" },
    { id: "tasks",      label: "📋 Task Status" },
    { id: "volunteers", label: "👥 Volunteers" },
  ] as const;

  const needColors: Record<string, string> = {
    food: "bg-orange-100 text-orange-800",
    medical: "bg-red-100 text-red-800",
    shelter: "bg-blue-100 text-blue-800",
    education: "bg-purple-100 text-purple-800",
    water: "bg-cyan-100 text-cyan-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">NGO Coordination Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Smart Resource Allocation Platform</p>
          </div>
          <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">● Live</span>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[
              { label: "Total Reports", value: stats.reports, color: "text-blue-600" },
              { label: "Volunteers", value: stats.volunteers, color: "text-green-600" },
              { label: "Available Now", value: stats.available, color: "text-emerald-600" },
              { label: "Total Tasks", value: stats.tasks, color: "text-purple-600" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg px-4 py-2 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-52 bg-white shadow-sm min-h-screen p-4 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2.5 rounded mb-1 text-sm font-medium transition-colors
                ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {tab.label}
            </button>
          ))}

          {/* Need type legend */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Need Types</p>
            {Object.entries(needColors).map(([type, cls]) => (
              <span key={type} className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 mr-1 ${cls}`}>
                {type}
              </span>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400 text-lg">Loading data...</div>
            </div>
          )}

          {!loading && activeTab === "map" && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Community Needs Heatmap
                <span className="ml-2 text-sm font-normal text-gray-500">({reports.length} active reports)</span>
              </h2>
              <div className="bg-white rounded-lg shadow p-4">
                <ReportHeatmap reports={reports} />
                <div className="flex gap-6 mt-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Low (0–4)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Medium (4–7)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> High (7–10)</span>
                </div>
              </div>
            </section>
          )}

          {!loading && activeTab === "priority" && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Priority Rankings</h2>
              <div className="bg-white rounded-lg shadow p-4">
                <PriorityList />
              </div>
            </section>
          )}

          {!loading && activeTab === "tasks" && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Task Status Overview</h2>
              <div className="bg-white rounded-lg shadow p-4">
                <TaskStatusCounts />
              </div>
            </section>
          )}

          {!loading && activeTab === "volunteers" && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Volunteer Activity</h2>
              <div className="bg-white rounded-lg shadow p-4">
                <VolunteerMetrics />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
