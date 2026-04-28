"use client";
import { useState } from "react";
import { tasksApi } from "../lib/api";
import FeedbackForm from "./FeedbackForm";

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

interface Props {
  task: Task;
  volunteerId: string;
  onBack: () => void;
  onUpdated: () => void;
}

export default function TaskDetail({ task, volunteerId, onBack, onUpdated }: Props) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    await tasksApi.updateStatus(task.task_id, "in_progress", volunteerId);
    setLoading(false);
    onUpdated();
  }

  async function reject() {
    if (!rejectReason.trim()) { alert("Please provide a rejection reason"); return; }
    setLoading(true);
    await tasksApi.updateStatus(task.task_id, "cancelled", volunteerId);
    setLoading(false);
    onUpdated();
  }

  async function complete() {
    setLoading(true);
    await tasksApi.updateStatus(task.task_id, "completed", volunteerId);
    setLoading(false);
    setShowFeedback(true);
  }

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${task.latitude}&mlon=${task.longitude}#map=15/${task.latitude}/${task.longitude}`;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <button onClick={onBack} className="text-blue-600 text-sm mb-4 hover:underline">← Back to tasks</button>

      <h2 className="text-lg font-bold mb-2">{task.task_id}</h2>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{task.status.replace("_", " ")}</span></div>
        <div><span className="text-gray-500">Priority:</span> <span className="font-medium">{task.priority_score?.toFixed(2)}</span></div>
        <div><span className="text-gray-500">Skills needed:</span> <span className="font-medium">{task.required_skills?.join(", ") || "—"}</span></div>
        <div>
          <span className="text-gray-500">Location:</span>{" "}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            {task.latitude?.toFixed(4)}, {task.longitude?.toFixed(4)}
          </a>
        </div>
      </div>

      {!showFeedback && (
        <div className="flex gap-3">
          {task.status === "pending" && (
            <>
              <button onClick={accept} disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50">
                Accept
              </button>
              <button onClick={() => setShowReject(true)} disabled={loading}
                className="flex-1 bg-red-100 text-red-700 py-2 rounded font-medium hover:bg-red-200">
                Reject
              </button>
            </>
          )}
          {task.status === "in_progress" && (
            <button onClick={complete} disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
              Mark Complete
            </button>
          )}
        </div>
      )}

      {showReject && (
        <div className="mt-4 space-y-2">
          <textarea
            className="border rounded px-3 py-2 w-full h-20 resize-none text-sm"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button onClick={reject} disabled={loading}
            className="w-full bg-red-600 text-white py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50">
            Confirm Rejection
          </button>
        </div>
      )}

      {showFeedback && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Submit Feedback</h3>
          <FeedbackForm
            taskId={task.task_id}
            volunteerId={volunteerId}
            reportId={task.report_id}
            onSubmitted={() => { setShowFeedback(false); onUpdated(); }}
          />
        </div>
      )}
    </div>
  );
}
