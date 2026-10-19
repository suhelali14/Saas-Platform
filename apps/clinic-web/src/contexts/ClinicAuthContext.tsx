import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../lib/api';

export interface ClinicStaffUser {
  id: string;
  email: string;
  name: string;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'PHARMACIST' | 'ADMIN';
  /** May administer staff, settings, the audit log and the website.
   *  Independent of `role`: a clinic head who is also a doctor is
   *  both, and a non-clinical practice manager is admin without any
   *  clinical write access. */
  isAdmin?: boolean;
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
  isAdmin: boolean;
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

  // DOCTOR only. This used to include ADMIN, which meant a practice
  // manager given admin rights saw clinical write controls -- and the
  // server, which had the same rule, accepted them. Administering a
  // clinic is not a clinical qualification.
  const canWriteClinical = user?.role === 'DOCTOR';
  // Hides the admin screens. The server enforces the same flag; this
  // only keeps the nav honest.
  const isAdmin = user?.isAdmin === true;

  return (
    <ClinicAuthContext.Provider value={{ user, clinicName, enabledFeatures, isLoading, isAuthenticated: !!user, canWriteClinical, isAdmin, login, logout }}>
      {children}
    </ClinicAuthContext.Provider>
  );
}

export function useClinicAuth() {
  const ctx = useContext(ClinicAuthContext);
  if (!ctx) throw new Error('useClinicAuth must be used within ClinicAuthProvider');
  return ctx;
}
