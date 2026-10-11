import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from './AuthContext';

interface BusinessDNA {
  id: string;
  name: string;
  type: string;
  description?: string;
  logo?: string;
  phone?: string;
  email?: string;
  languages: string[];
  currency: string;
  timezone: string;
  workingHours?: any;
  deliveryRules?: any;
  paymentMethods: string[];
  pricingRules?: any;
  policies?: any;
}

interface BusinessContextType {
  dna: BusinessDNA | null;
  isLoading: boolean;
  refreshDNA: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [dna, setDna] = useState<BusinessDNA | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { fetchWithAuth } = useApi();
  const { isAuthenticated, business } = useAuth();

  const refreshDNA = async () => {
    if (!isAuthenticated) {
      setDna(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetchWithAuth('/business/profile');
      if (response.success) {
        setDna(response.data);
      }
    } catch (error) {
      console.error('Failed to load Business DNA', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshDNA();
  }, [isAuthenticated, business?.id]);

  return (
    <BusinessContext.Provider
      value={{
        dna,
        isLoading,
        refreshDNA,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
