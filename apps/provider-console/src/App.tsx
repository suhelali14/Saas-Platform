import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { LogOut, Building2, Receipt, Presentation, FileText, Sprout, Repeat } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Login } from "./pages/Login";
import { Accounts } from "./pages/Accounts";
import { AccountDetail } from "./pages/AccountDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Billing } from "./pages/Billing";
import { Demos } from "./pages/Demos";
import { InvoiceView } from "./pages/InvoiceView";
import { Quotations } from "./pages/Quotations";
import { QuotationDetail } from "./pages/QuotationDetail";
import { AgreementDetail } from "./pages/AgreementDetail";
import { Growth } from "./pages/Growth";
import { GrowthModels } from "./pages/GrowthModels";
import { Subscriptions } from "./pages/Subscriptions";

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
  const onBilling = pathname.startsWith("/billing") || pathname.startsWith("/invoices");
  const onDemos = pathname.startsWith("/demos");
  const onPipeline = pathname.startsWith("/quotations") || pathname.startsWith("/agreements");
  const onGrowth = pathname.startsWith("/growth");
  const onSubs = pathname.startsWith("/subscriptions");
  const tab = (on: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
      on ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            {/* Growth's mark: an ink tile with the amber and tan bars. */}
            <svg className="size-7" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#1b1a17" />
              <rect x="6" y="12" width="9" height="4" rx="2" fill="#eba63f" />
              <rect x="16.5" y="12" width="5.5" height="4" rx="2" fill="#b9ad95" />
            </svg>
            <span className="font-display text-[19px] font-semibold uppercase tracking-[0.03em]">Nayaversse Console</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            <Link
              to="/"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                onClinics
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Building2 className="size-4" />
              Clinics
            </Link>
            <Link to="/growth" className={tab(onGrowth)}>
              <Sprout className="size-4" />
              Growth
            </Link>
            <Link to="/subscriptions" className={tab(onSubs)}>
              <Repeat className="size-4" />
              Subscriptions
            </Link>
            <Link
              to="/quotations"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                onPipeline
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <FileText className="size-4" />
              Pipeline
            </Link>
            <Link
              to="/billing"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                onBilling
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Receipt className="size-4" />
              Billing
            </Link>
            <Link
              to="/demos"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                onDemos
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Presentation className="size-4" />
              Demos
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
            <Route path="/billing" element={<Protected><Shell><Billing /></Shell></Protected>} />
            <Route path="/growth" element={<Protected><Shell><Growth /></Shell></Protected>} />
            <Route path="/growth/models" element={<Protected><Shell><GrowthModels /></Shell></Protected>} />
            <Route path="/subscriptions" element={<Protected><Shell><Subscriptions /></Shell></Protected>} />
            <Route path="/demos" element={<Protected><Shell><Demos /></Shell></Protected>} />
            <Route path="/invoices/:id" element={<Protected><Shell><InvoiceView /></Shell></Protected>} />
            <Route path="/quotations" element={<Protected><Shell><Quotations /></Shell></Protected>} />
            <Route path="/quotations/:id" element={<Protected><Shell><QuotationDetail /></Shell></Protected>} />
            <Route path="/agreements/:id" element={<Protected><Shell><AgreementDetail /></Shell></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
