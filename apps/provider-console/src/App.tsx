import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { ShieldCheck, LogOut, Building2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Login } from "./pages/Login";
import { Accounts } from "./pages/Accounts";
import { AccountDetail } from "./pages/AccountDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Booting({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-background p-8" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Booting label="Loading the console" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * The login route needs its own guard in the other direction.
 *
 * Signing in sets the user in context, but nothing moved the router off
 * /login -- so a successful sign-in stored the token, re-rendered, and
 * showed the login form again. From the outside that looked exactly like
 * a failed login, which is the worst possible way for it to break.
 */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Booting label="Loading the console" />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const onClinics = pathname === "/" || pathname.startsWith("/clinics");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
              <ShieldCheck className="size-4 text-primary" />
            </span>
            Provider Console
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            <Link
              to="/"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                onClinics
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Building2 className="size-4" />
              Clinics
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
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
