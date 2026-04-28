"use client";
import { useState, useEffect } from "react";
import { tasksApi } from "../../lib/api";
import TaskDetail from "../../components/TaskDetail";

interface Task {
  task_id: string;
  report_id: string;
  status: string;
  priority_score: number;
  required_skills: string[];
  latitude: number;
  longitude: number;
  assigned_volunteer_ids: string[];
}

export default function VolunteerInterface() {
  const [volunteerId, setVolunteerId] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  async function login() {
    if (!volunteerId.trim()) return;
    setLoggedIn(true);
  }

  async function loadTasks() {
    const data = await tasksApi.list({ volunteer: volunteerId });
    setTasks(data as Task[]);
  }

  useEffect(() => {
    if (loggedIn) {
      loadTasks();
      const interval = setInterval(loadTasks, 30_000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, volunteerId]);

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 w-96">
          <h1 className="text-xl font-bold mb-4">Volunteer Login</h1>
          <input
            type="text" placeholder="Enter your Volunteer ID"
            className="border rounded px-3 py-2 w-full mb-4"
            value={volunteerId}
            onChange={(e) => setVolunteerId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button onClick={login}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">
            Login
          </button>
        </div>
      </div>
    );
  }

  if (selectedTask) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <TaskDetail
          task={selectedTask}
          volunteerId={volunteerId}
          onBack={() => setSelectedTask(null)}
          onUpdated={() => { setSelectedTask(null); loadTasks(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">My Tasks</h1>
        <span className="text-sm text-gray-500">Volunteer: {volunteerId}</span>
      </header>

      <main className="p-6">
        {tasks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
            No tasks assigned yet
          </div>
        )}

        <div className="grid gap-4">
          {tasks.map((t) => (
            <div
              key={t.task_id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTask(t)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{t.task_id}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium
                  ${t.status === "pending"     ? "bg-yellow-100 text-yellow-800" : ""}
                  ${t.status === "in_progress" ? "bg-blue-100 text-blue-800"    : ""}
                  ${t.status === "completed"   ? "bg-green-100 text-green-800"  : ""}`}>
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <span>Priority: {t.priority_score?.toFixed(2)}</span>
                <span className="mx-2">•</span>
                <span>Skills: {t.required_skills?.join(", ") || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
