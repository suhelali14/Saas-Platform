import type {
  Business,
  BusinessDetail,
  FunnelEventType,
  IntentRequest,
  SubmitIntentResponse,
  UserProfileDTO,
} from "@intently/shared-types";
import { API_URL } from "./config";
import { getStoredToken } from "./auth";

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getStoredToken();
  if (!token) {
    // Shouldn't happen -- the auth flow (see AuthContext) gates access to
    // every screen that calls this until login/register/guest completes.
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Request failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return res.json();
}

export function submitIntentRequest(rawText: string): Promise<SubmitIntentResponse> {
  return authedFetch<SubmitIntentResponse>("/api/intent-requests", {
    method: "POST",
    body: JSON.stringify({ rawText }),
  });
}

export function fetchIntentRequest(id: string): Promise<SubmitIntentResponse> {
  return authedFetch<SubmitIntentResponse>(`/api/intent-requests/${id}`);
}

export function sendIntentMessage(intentRequestId: string, content: string): Promise<SubmitIntentResponse> {
  return authedFetch<SubmitIntentResponse>(`/api/intent-requests/${intentRequestId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function fetchIntentRequests(): Promise<IntentRequest[]> {
  return authedFetch<IntentRequest[]>("/api/intent-requests");
}

export function fetchBusiness(id: string): Promise<BusinessDetail> {
  return authedFetch<BusinessDetail>(`/api/businesses/${id}`);
}

export function fetchBusinesses(): Promise<Business[]> {
  return authedFetch<Business[]>("/api/businesses");
}

export function fetchUserProfile(): Promise<UserProfileDTO> {
  return authedFetch<UserProfileDTO>("/api/users/me/profile");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return authedFetch<void>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// docs/14-mvp-implementation-plan.md M7's funnel. INTENT_SUBMITTED and
// RESULTS_SHOWN are recorded server-side automatically; this is only for
// RESULT_OPENED, fired when a match card is tapped -- a later, disconnected
// user action the server can't observe on its own. Fire-and-forget: a
// dropped analytics event should never block navigation.
export function recordFunnelEvent(eventType: FunnelEventType, intentRequestId?: string): void {
  authedFetch<{ ok: true }>("/api/funnel-events", {
    method: "POST",
    body: JSON.stringify({ eventType, intentRequestId }),
  }).catch(() => {});
}
