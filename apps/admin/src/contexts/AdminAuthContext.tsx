import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../lib/api';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'REVIEWER' | 'SUPPORT';
}

interface AdminAuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('adminAccessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetch<Admin>('/auth/me');
        setAdmin(me);
      } catch {
        localStorage.removeItem('adminAccessToken');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; admin: Admin }>('/auth/login', { method: 'POST', data: { email, password } });
    localStorage.setItem('adminAccessToken', res.token);
    setAdmin(res.admin);
  };

  const logout = () => {
    localStorage.removeItem('adminAccessToken');
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, isAuthenticated: !!admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
