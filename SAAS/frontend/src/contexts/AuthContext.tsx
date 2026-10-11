import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useApi, setGlobalLogout } from '../hooks/useApi';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  plan?: string;
  aiProvider?: string;
  aiApiKey?: string;
  razorpayKeyId?: string;
  onboardingCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User, business: Business) => void;
  logout: () => void;
  updateBusiness: (data: Partial<Business>) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { fetchWithAuth } = useApi();

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    setUser(null);
    setBusiness(null);
  }, []);

  // Register global logout handler so useApi can auto-logout on 401
  useEffect(() => {
    setGlobalLogout(logout);
  }, [logout]);

  const refreshAuth = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      try {
        const response = await fetchWithAuth('/auth/me');
        if (response && response.success && response.data) {
          setUser({
            id: response.data.id,
            email: response.data.email,
            name: response.data.name,
            role: response.data.role,
          });
          setBusiness({
            id: response.data.business.id,
            name: response.data.business.name,
            slug: response.data.business.slug,
            type: response.data.business.type,
            onboardingCompleted: response.data.business.onboardingCompleted,
          });
        }
      } catch (e) {
        console.error('Failed to refresh auth', e);
      }
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const response = await fetchWithAuth('/auth/me');
          if (response && response.success && response.data) {
            setUser({
              id: response.data.id,
              email: response.data.email,
              name: response.data.name,
              role: response.data.role,
            });
            setBusiness({
              id: response.data.business.id,
              name: response.data.business.name,
              slug: response.data.business.slug,
              type: response.data.business.type,
              onboardingCompleted: response.data.business.onboardingCompleted,
            });
          } else {
            logout();
          }
        } catch (error) {
          console.error('Auth initialization failed', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (token: string, userData: User, businessData: Business) => {
    // Single access token -- this backend deliberately has no refresh-token
    // flow (see biz-auth.ts), matching Intently's own consumer auth, which
    // doesn't have one either.
    localStorage.setItem('accessToken', token);
    setUser(userData);
    setBusiness(businessData);
  };

  const updateBusiness = (data: Partial<Business>) => {
    setBusiness(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateBusiness,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
