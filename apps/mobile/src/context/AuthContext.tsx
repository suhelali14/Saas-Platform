import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeResponse } from "@intently/shared-types";
import * as SplashScreen from "expo-splash-screen";
import {
  clearDeviceId,
  clearToken,
  continueAsGuest as continueAsGuestRequest,
  fetchMe,
  getStoredToken,
  login as loginRequest,
  register as registerRequest,
} from "../lib/auth";
import { queryClient } from "../lib/query-client";

interface AuthContextValue {
  user: MeResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentUser(): Promise<MeResponse | null> {
  const token = await getStoredToken();
  if (!token) return null;
  return fetchMe(token);
}

/**
 * Gates the whole app on auth state (docs/14-mvp-implementation-plan.md M5
 * upgrade: register/login now, not just anonymous). RootNavigator renders
 * AuthNavigator vs. the main tabs based on `user` here. The native splash
 * screen (see App.tsx's SplashScreen.preventAutoHideAsync()) stays up until
 * the initial session check below resolves, so there's no flash of the
 * Welcome screen for an already-logged-in user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadCurrentUser()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => clearToken())
      .finally(() => {
        if (!cancelled) setIsLoading(false);
        SplashScreen.hideAsync().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshMe() {
    setUser(await loadCurrentUser());
  }

  async function login(email: string, password: string) {
    await loginRequest(email, password);
    await refreshMe();
  }

  async function register(name: string, email: string, password: string) {
    await registerRequest(name, email, password);
    await refreshMe();
  }

  async function continueAsGuest() {
    await continueAsGuestRequest();
    await refreshMe();
  }

  async function logout() {
    // A guest identity has no credential to log back in with -- the device
    // id *is* the identity. Drop it too, or "Continue as Guest" next time
    // silently resurrects this same account via the anonymous-auth upsert.
    if (user?.isGuest) {
      await clearDeviceId();
    }
    await clearToken();
    // Wipe cached query data (matches, activity, profile, ...) so nothing
    // from this session leaks into whatever the next login/guest session
    // renders before its own fetches land.
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, continueAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
