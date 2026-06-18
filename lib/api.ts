// ============================================================================
// Typed client for the inference + analytics contract. Today these call the
// Next.js route handlers under app/api/* which read Supabase if present, else
// compute the transparent heuristic from lib/sample.ts.
//
// TODO: wire to /api/py inference (Python joblib model + SHAP). The route
// handlers are the single swap point — this client signature stays stable.
// ============================================================================

import type {
  AdvisorResult,
  CohortStatsResult,
  CustomerFeatures,
  EdaSummary,
  ExplainResponse,
  PredictResult,
} from "./types";

function baseUrl(): string {
  if (typeof window !== "undefined") return "";
  // Server-side fetch needs an absolute URL.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /** Predict churn from raw features (ad-hoc). */
  predict(features: CustomerFeatures): Promise<PredictResult> {
    return postJSON<PredictResult>("/api/predict", { features });
  },

  /** Explain a known customer (score + SHAP local + raw features). */
  explainUser(customerId: string): Promise<ExplainResponse> {
    return getJSON<ExplainResponse>(`/api/explain/${encodeURIComponent(customerId)}`);
  },

  /** Advisor recommendation (Function A + B) for a customer. */
  recommend(customerId: string): Promise<AdvisorResult> {
    return postJSON<AdvisorResult>("/api/recommend", { customerId });
  },

  /** Aggregate cohort stats for the dashboard. */
  cohortStats(): Promise<CohortStatsResult> {
    return getJSON<CohortStatsResult>("/api/cohort-stats");
  },

  /** EDA summary for the analytics screen. */
  edaSummary(): Promise<EdaSummary> {
    return getJSON<EdaSummary>("/api/eda-summary");
  },
};
