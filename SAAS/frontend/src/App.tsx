import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// Pages
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';

// Core Business & Intelligence Modules
import { Customers } from './pages/Customers';
import { Catalog } from './pages/Catalog';
import { Orders } from './pages/Orders';
import { Inventory } from './pages/Inventory';
import { Employees } from './pages/Employees';
import { Conversations } from './pages/Conversations';
import { Website } from './pages/Website';
import { Growth } from './pages/Growth';
import { Payments } from './pages/Payments';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Bookings } from './pages/Bookings';
import { KYC } from './pages/KYC';
import { Tickets } from './pages/Tickets';


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, business } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but onboarding not complete, force them to onboarding
  if (business && !business.onboardingCompleted && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login isRegister />} />

      {/* Onboarding Route (Protected but outside standard layout) */}
      <Route 
        path="/onboarding" 
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } 
      />

      {/* Protected App Routes */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        } 
      />
      
      {/* All 10 Core Business & Intelligence Modules */}
      <Route path="/bookings" element={<ProtectedRoute><AppLayout><Bookings /></AppLayout></ProtectedRoute>} />
      <Route path="/conversations" element={<ProtectedRoute><AppLayout><Conversations /></AppLayout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><AppLayout><Orders /></AppLayout></ProtectedRoute>} />

      <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
      <Route path="/catalog" element={<ProtectedRoute><AppLayout><Catalog /></AppLayout></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><AppLayout><Employees /></AppLayout></ProtectedRoute>} />
      
      {/* Website Builder gets its own full-screen layout */}
      <Route path="/website" element={<ProtectedRoute><Website /></ProtectedRoute>} />
      
      <Route path="/growth" element={<ProtectedRoute><AppLayout><Growth /></AppLayout></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><AppLayout><Payments /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="/kyc" element={<ProtectedRoute><AppLayout><KYC /></AppLayout></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><AppLayout><Tickets /></AppLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
