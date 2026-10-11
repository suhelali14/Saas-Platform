import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { KycQueue } from './pages/KycQueue';
import { KycDetail } from './pages/KycDetail';
import { Tickets } from './pages/Tickets';
import { TicketDetail } from './pages/TicketDetail';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-gray-400">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/kyc" replace />} />
            <Route path="/kyc" element={<KycQueue />} />
            <Route path="/kyc/:id" element={<KycDetail />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
