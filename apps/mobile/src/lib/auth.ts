import type { AuthResponse, MeResponse } from "@intently/shared-types";
import * as Crypto from "expo-crypto";
import { API_URL } from "./config";
import { getItem, setItem, deleteItem } from "./storage";

const TOKEN_KEY = "intently.token";
const DEVICE_ID_KEY = "intently.deviceId";

export function getStoredToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
}

// Guest logout needs to drop this too, not just the token -- otherwise
// "Continue as Guest" immediately after logging out reuses the same
// deviceId and the backend upserts back into the exact same account
// (see /api/auth/anonymous), so logout silently did nothing for guests.
export async function clearDeviceId(): Promise<void> {
  await deleteItem(DEVICE_ID_KEY);
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await setItem(DEVICE_ID_KEY, id);
  return id;
}

async function postAuth(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = typeof errorBody?.error === "string" ? errorBody.error : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  const data: AuthResponse = await res.json();
  await setItem(TOKEN_KEY, data.token);
  return data;
}

export function register(name: string, email: string, password: string): Promise<AuthResponse> {
  return postAuth("/api/auth/register", { name, email, password });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return postAuth("/api/auth/login", { email, password });
}

export async function continueAsGuest(): Promise<AuthResponse> {
  const deviceId = await getOrCreateDeviceId();
  return postAuth("/api/auth/anonymous", { deviceId });
}

export async function fetchMe(token: string): Promise<MeResponse> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Session invalid: ${res.status}`);
  }
  return res.json();
}
