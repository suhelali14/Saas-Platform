import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../lib/api';

export interface ClinicStaffUser {
  id: string;
  email: string;
  name: string;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
}

interface MeResponse {
  user: ClinicStaffUser;
  clinic: { name: string; doctorName: string | null } | null;
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM';
  enabledFeatures: { staff: boolean };
}

interface ClinicAuthContextType {
  user: ClinicStaffUser | null;
  clinicName: string | null;
  enabledFeatures: { staff: boolean };
  isLoading: boolean;
  isAuthenticated: boolean;
  canWriteClinical: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const ClinicAuthContext = createContext<ClinicAuthContextType | undefined>(undefined);

export function ClinicAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClinicStaffUser | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState({ staff: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('clinicAccessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetch<MeResponse>('/auth/me');
        setUser(me.user);
        setClinicName(me.clinic?.name ?? null);
        setEnabledFeatures(me.enabledFeatures);
      } catch {
        localStorage.removeItem('clinicAccessToken');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: ClinicStaffUser }>('/auth/login', { method: 'POST', data: { email, password } });
    localStorage.setItem('clinicAccessToken', res.token);
    setUser(res.user);
    const me = await apiFetch<MeResponse>('/auth/me');
    setClinicName(me.clinic?.name ?? null);
    setEnabledFeatures(me.enabledFeatures);
  };

  const logout = () => {
    localStorage.removeItem('clinicAccessToken');
    setUser(null);
  };

  const canWriteClinical = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  return (
    <ClinicAuthContext.Provider value={{ user, clinicName, enabledFeatures, isLoading, isAuthenticated: !!user, canWriteClinical, login, logout }}>
      {children}
    </ClinicAuthContext.Provider>
  );
}

export function useClinicAuth() {
  const ctx = useContext(ClinicAuthContext);
  if (!ctx) throw new Error('useClinicAuth must be used within ClinicAuthProvider');
  return ctx;
}
