/**
 * API client — uses relative URLs so requests go through Next.js rewrites proxy.
 * This works both in Docker and locally without CORS issues.
 */
import axios from "axios";
import { getToken } from "./auth";

export const api = axios.create({ baseURL: "" });

// Attach JWT token to every request
api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const reportsApi = {
  list: (status?: string) =>
    api.get("/api/reports", { params: status ? { status } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/api/reports/${id}`).then((r) => r.data),
  create: (body: FormData) =>
    api.post("/api/reports", body, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
};

export const volunteersApi = {
  list: (params?: { skill?: string; available?: boolean; bbox?: string }) =>
    api.get("/api/volunteers", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/api/volunteers/${id}`).then((r) => r.data),
  create: (body: object) => api.post("/api/volunteers", body).then((r) => r.data),
  update: (id: string, body: object) => api.put(`/api/volunteers/${id}`, body).then((r) => r.data),
};

export const tasksApi = {
  list: (params?: { status?: string; volunteer?: string; region?: string }) =>
    api.get("/api/tasks", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/api/tasks/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string, volunteer_id?: string) =>
    api.put(`/api/tasks/${id}/status`, { status, volunteer_id }).then((r) => r.data),
};

export const feedbackApi = {
  create: (body: object) => api.post("/api/feedback", body).then((r) => r.data),
  metrics: (params?: { volunteer?: string; task_type?: string }) =>
    api.get("/api/feedback/metrics", { params }).then((r) => r.data),
};
