import type {
  BusinessDetail,
  BusinessWithStats,
  CreateBusinessRequest,
  CreateOfferRequest,
  PlatformStats,
} from "@intently/shared-types";

export interface HealthResult {
  ok: boolean;
  data?: { status: string; service: string; timestamp: string };
  error?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, data: await res.json() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function fetchBusinesses(): Promise<ApiResult<BusinessWithStats[]>> {
  return apiFetch("/api/businesses");
}

export function fetchBusiness(id: string): Promise<ApiResult<BusinessDetail>> {
  return apiFetch(`/api/businesses/${id}`);
}

export function createBusiness(payload: CreateBusinessRequest): Promise<ApiResult<BusinessDetail>> {
  return apiFetch("/api/businesses", { method: "POST", body: JSON.stringify(payload) });
}

export function createOffer(businessId: string, payload: CreateOfferRequest): Promise<ApiResult<unknown>> {
  return apiFetch(`/api/businesses/${businessId}/offers`, { method: "POST", body: JSON.stringify(payload) });
}

export function fetchPlatformStats(): Promise<ApiResult<PlatformStats>> {
  return apiFetch("/api/stats");
}
