import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { SkeletonPage } from './components/Skeleton';
import { Login } from './pages/Login';
import { Accounts } from './pages/Accounts';
import { AccountDetail } from './pages/AccountDetail';

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-[#0b0d12]"><SkeletonPage label="Loading the console" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * The login route needs its own guard in the other direction.
 *
 * Signing in sets the user in context, but nothing moved the router off
 * /login -- so a successful sign-in stored the token, re-rendered, and
 * showed the login form again. From the outside it looked exactly like a
 * failed login, which is the worst possible way for this to break.
 */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-[#0b0d12]"><SkeletonPage label="Loading the console" /></div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0d12]/95 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-sm">
            <ShieldCheck size={18} className="text-emerald-400" /> Provider Console
          </Link>
          <nav className="flex items-center gap-1 flex-1">
            <Link to="/" className={`px-3 py-1.5 rounded-lg text-sm ${pathname === '/' ? 'bg-white text-black' : 'text-gray-300 hover:bg-white/10'}`}>
              Clinics
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:inline">{user?.name}</span>
            <button onClick={logout} className="p-2 rounded-lg text-gray-400 hover:bg-white/10" aria-label="Sign out" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/" element={<Protected><Shell><Accounts /></Shell></Protected>} />
          <Route path="/clinics/:id" element={<Protected><Shell><AccountDetail /></Shell></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
