import { useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface FetchOptions extends RequestInit {
  data?: any;
  skipAuth?: boolean;
}

// Global logout callback — set by AuthContext on mount
let globalLogout: (() => void) | null = null;
export function setGlobalLogout(fn: () => void) {
  globalLogout = fn;
}

export function useApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (endpoint: string, options: FetchOptions = {}) => {
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem('accessToken');

    const headers = new Headers(options.headers);
    if (token && !options.skipAuth) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.data && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        body: options.data ? JSON.stringify(options.data) : options.body,
      });

      // Auto-logout on 401
      if (response.status === 401) {
        if (globalLogout) {
          globalLogout();
        }
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || `Request failed (${response.status})`);
      }

      return data;
    } catch (err: any) {
      const message = err.message || 'An unexpected error occurred';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchWithAuth, isLoading, error, setError };
}
