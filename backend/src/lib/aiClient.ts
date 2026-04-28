/**
 * Typed Axios client for the AI microservice.
 * Includes retry logic: 3 attempts with 500ms backoff.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { config } from "../config";

const BASE_URL = config.aiServiceUrl;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(
  client: AxiosInstance,
  reqConfig: AxiosRequestConfig,
  attempt = 1
): Promise<T> {
  try {
    const res = await client.request<T>(reqConfig);
    return res.data;
  } catch (err: unknown) {
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
      return requestWithRetry<T>(client, reqConfig, attempt + 1);
    }
    throw err;
  }
}

const client = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

export const aiClient = {
  process: (body: { report_id?: string; text: string }) =>
    requestWithRetry<{
      report_id: string | null;
      need_type: string | null;
      urgency_score: number;
      confidence_need_type: number;
      confidence_urgency: number;
      used_fallback_need: boolean;
      used_fallback_urgency: boolean;
      is_flagged_review: boolean;
    }>(client, { method: "POST", url: "/ai/process", data: body }),

  priority: (body: {
    report_id?: string;
    urgency_score?: number;
    people_affected?: number;
    timestamp?: string;
  }) =>
    requestWithRetry<{
      report_id: string | null;
      priority_score: number;
      is_incomplete_score: boolean;
    }>(client, { method: "POST", url: "/ai/priority", data: body }),

  match: (body: {
    task_id: string;
    need_type: string;
    latitude: number;
    longitude: number;
    volunteers: Array<{
      volunteer_id: string;
      skills: string[];
      latitude: number;
      longitude: number;
      availability: boolean;
      rating: number;
    }>;
  }) =>
    requestWithRetry<{
      task_id: string;
      matches: Array<{
        volunteer_id: string;
        match_score: number;
        skill_score: number;
        distance_km: number;
        distance_score: number;
        rating: number;
      }>;
      is_understaffed: boolean;
    }>(client, { method: "POST", url: "/ai/match", data: body }),

  geoRoute: (body: {
    volunteer_id: string;
    start_lat: number;
    start_lon: number;
    tasks: Array<{ task_id: string; latitude: number; longitude: number }>;
  }) =>
    requestWithRetry<{
      volunteer_id: string;
      route: Array<{
        task_id: string;
        latitude: number;
        longitude: number;
        estimated_travel_minutes: number;
      }>;
      is_approximate: boolean;
    }>(client, { method: "POST", url: "/ai/geo/route", data: body }),
};
