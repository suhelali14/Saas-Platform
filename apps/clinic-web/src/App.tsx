import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClinicAuthProvider, useClinicAuth } from './contexts/ClinicAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { SkeletonPage } from './components/Skeleton';
import { SITE_MODE } from './lib/site-mode';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Queue } from './pages/Queue';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Encounter } from './pages/Encounter';
import { Staff } from './pages/Staff';
import { Analytics } from './pages/Analytics';
import { Pharmacy } from './pages/Pharmacy';
import { Reminders } from './pages/Reminders';
import { Billing } from './pages/Billing';
import { Labs } from './pages/Labs';
import { PublicQueue } from './pages/PublicQueue';
import { PublicClinic } from './pages/PublicClinic';
import { Settings } from './pages/Settings';
import { AuditLog } from './pages/AuditLog';
import { Expenses } from './pages/Expenses';
import { Website } from './pages/Website';
import { PublicBlog } from './pages/PublicBlog';
import { PublicBlogPost } from './pages/PublicBlogPost';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useClinicAuth();
  if (isLoading) return <div className="min-h-screen bg-[#0b0d12]"><SkeletonPage label="Loading your clinic" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { enabledFeatures } = useClinicAuth();
  if (!enabledFeatures.staff) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

const PHARMACY_ROLES = new Set(['PHARMACIST', 'DOCTOR', 'ADMIN']);

function PharmacyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !PHARMACY_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

const BILLING_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);

function BillingRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !BILLING_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

const ADMIN_ROLES = new Set(['DOCTOR', 'ADMIN']);

/** The audit log reveals which staff member looked at which patient, so it
 * is doctor/admin only -- the same gate the API enforces. This only hides
 * the screen; the server refuses the data regardless. */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !ADMIN_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

/**
 * Route trees are chosen by hostname, not merged.
 *
 * On a split deployment the patient site owns `/` on its own domain and the
 * portal owns `/` on its own, from a single build -- see lib/site-mode.ts.
 * In `both` mode (localhost, or a single-domain deployment) every route is
 * mounted exactly as before, so nothing about development changes.
 *
 * The portal's routes are NOT a security boundary here: they still require
 * a token, and the API enforces RBAC no matter which hostname asked.
 * Splitting is about giving patients a clean address.
 */
/**
 * Route lists are plain arrays of <Route> elements, not components.
 *
 * <Routes> inspects its children to build the route table, so a wrapper
 * component around them is not reliably transparent -- reaching into
 * `Component().props.children` typechecks but depends on internals. An
 * array spreads into <Routes> as real children, which is what it expects.
 */
function publicRoutes() {
  return [
    <Route key="home" path="/" element={<PublicClinic />} />,
    <Route key="blog" path="/blog" element={<PublicBlog />} />,
    <Route key="post" path="/blog/:slug" element={<PublicBlogPost />} />,
    <Route key="lq" path="/live-queue" element={<PublicQueue />} />,
    // Anyone following an old /clinic link lands in the right place.
    <Route key="legacy" path="/clinic" element={<Navigate to="/" replace />} />,
    // A patient mistyping a path gets the clinic, never a blank screen.
    <Route key="fallback" path="*" element={<Navigate to="/" replace />} />,
  ];
}

function portalRoutes() {
  return [
    <Route key="login" path="/login" element={<Login />} />,
    // The waiting-room display belongs to staff too -- it is opened on a
    // screen inside the clinic, not typed in by a patient.
    <Route key="lq" path="/live-queue" element={<PublicQueue />} />,
    <Route
      key="app"
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route index path="/" element={<Navigate to="/queue" replace />} />
      <Route path="/queue" element={<Queue />} />
      <Route path="/patients" element={<Patients />} />
      <Route path="/patients/:id" element={<PatientDetail />} />
      <Route path="/appointments/:id/encounter" element={<Encounter />} />
      <Route path="/reminders" element={<Reminders />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/pharmacy" element={<PharmacyRoute><Pharmacy /></PharmacyRoute>} />
      <Route path="/labs" element={<Labs />} />
      <Route path="/billing" element={<BillingRoute><Billing /></BillingRoute>} />
      <Route path="/expenses" element={<BillingRoute><Expenses /></BillingRoute>} />
      <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />
      <Route path="/website" element={<AdminRoute><Website /></AdminRoute>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/staff" element={<StaffRoute><Staff /></StaffRoute>} />
    </Route>,
  ];
}

/**
 * Which site this is comes from the hostname -- one build serves both.
 * See lib/site-mode.ts for the resolution order and why it is decided in
 * the client rather than with per-host rewrite rules at the edge.
 */
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <ClinicAuthProvider>
        <BrowserRouter>
          <Routes>
            {SITE_MODE === 'public' && publicRoutes()}
            {SITE_MODE === 'portal' && portalRoutes()}
            {SITE_MODE === 'both' && [
              // Single-domain / development: the patient site keeps its
              // /clinic path so both fit on one origin, exactly as before.
              <Route key="clinic" path="/clinic" element={<PublicClinic />} />,
              <Route key="blog" path="/blog" element={<PublicBlog />} />,
              <Route key="post" path="/blog/:slug" element={<PublicBlogPost />} />,
              ...portalRoutes(),
            ]}
          </Routes>
        </BrowserRouter>
      </ClinicAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
