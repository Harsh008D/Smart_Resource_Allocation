"use client";
import { useState } from "react";
import { feedbackApi } from "../lib/api";

interface Props {
  taskId: string;
  volunteerId: string;
  reportId: string;
  onSubmitted: () => void;
}

export default function FeedbackForm({ taskId, volunteerId, reportId, onSubmitted }: Props) {
  const [form, setForm] = useState({
    completion_status: "success",
    ground_reality_text: "",
    difficulty_rating: 3,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await feedbackApi.create({ ...form, task_id: taskId, volunteer_id: volunteerId, report_id: reportId });
      onSubmitted();
    } catch (err) {
      console.error(err);
      alert("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Completion Status</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={form.completion_status}
          onChange={(e) => setForm((f) => ({ ...f, completion_status: e.target.value }))}
        >
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Ground Reality Description</label>
        <textarea
          className="border rounded px-3 py-2 w-full h-24 resize-none"
          placeholder="Describe the actual situation on the ground..."
          value={form.ground_reality_text}
          onChange={(e) => setForm((f) => ({ ...f, ground_reality_text: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Task Difficulty: {form.difficulty_rating} / 5
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button"
              onClick={() => setForm((f) => ({ ...f, difficulty_rating: n }))}
              className={`w-10 h-10 rounded-full border-2 font-semibold transition-colors
                ${form.difficulty_rating === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:border-blue-400"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit" disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </button>
    </form>
  );
}
