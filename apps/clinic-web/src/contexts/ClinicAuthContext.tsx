import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../lib/api';

export interface ClinicStaffUser {
  id: string;
  email: string;
  name: string;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'PHARMACIST' | 'ADMIN' | 'CASHIER' | 'BILLING_CLERK' | 'LAB_TECH' | 'RADIOGRAPHER';
  /** May administer staff, settings, the audit log and the website.
   *  Independent of `role`: a clinic head who is also a doctor is
   *  both, and a non-clinical practice manager is admin without any
   *  clinical write access. */
  isAdmin?: boolean;
}

/** What this clinic's plan includes, and the account's state. */
export interface Entitlement {
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  planLabel: string;
  /** Every module and whether it is on. The API never registers one that
   *  is off; this only keeps the menu honest. */
  modules: Record<string, boolean>;
  /** Suspended: everything can be viewed, nothing changed. */
  readOnly: boolean;
  /** A demonstration deployment with made-up patients. */
  demo: boolean;
  /** Who to ask for a module the plan does not include. */
  upgradeContact: string | null;
}

interface MeResponse {
  user: ClinicStaffUser;
  clinic: { name: string; doctorName: string | null } | null;
  plan: Entitlement['plan'];
  planLabel?: string;
  enabledFeatures: Record<string, boolean>;
  readOnly?: boolean;
  demo?: boolean;
  upgradeContact?: string | null;
}

const NO_ENTITLEMENT: Entitlement = { plan: 'BASIC', planLabel: 'Clinic', modules: {}, readOnly: false, demo: false, upgradeContact: null };

function toEntitlement(me: MeResponse): Entitlement {
  return {
    plan: me.plan,
    planLabel: me.planLabel ?? me.plan,
    modules: me.enabledFeatures ?? {},
    readOnly: !!me.readOnly,
    demo: !!me.demo,
    upgradeContact: me.upgradeContact ?? null,
  };
}

interface ClinicAuthContextType {
  user: ClinicStaffUser | null;
  clinicName: string | null;
  /** Kept for existing call sites; the same map as entitlement.modules. */
  enabledFeatures: Record<string, boolean>;
  entitlement: Entitlement;
  hasModule: (key: string) => boolean;
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
  const [entitlement, setEntitlement] = useState<Entitlement>(NO_ENTITLEMENT);
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
        setEntitlement(toEntitlement(me));
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
    setEntitlement(toEntitlement(me));
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
  const enabledFeatures = entitlement.modules;
  const hasModule = (key: string) => entitlement.modules[key] === true;

  return (
    <ClinicAuthContext.Provider value={{ user, clinicName, enabledFeatures, entitlement, hasModule, isLoading, isAuthenticated: !!user, canWriteClinical, isAdmin, login, logout }}>
      {children}
    </ClinicAuthContext.Provider>
  );
}

export function useClinicAuth() {
  const ctx = useContext(ClinicAuthContext);
  if (!ctx) throw new Error('useClinicAuth must be used within ClinicAuthProvider');
  return ctx;
}
