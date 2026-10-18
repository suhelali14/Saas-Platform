import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClinicAuthProvider, useClinicAuth } from './contexts/ClinicAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { SkeletonPage } from './components/Skeleton';
import { siteMode } from './lib/site-mode';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

/**
 * ── Why every screen below is lazy ───────────────────────────────────
 *
 * One build serves the clinic's patient website and the staff portal on
 * two different hostnames (lib/site-mode.ts). Every page used to be a
 * static import, which meant one chunk containing both: 875KB of
 * JavaScript, 246KB over the wire, and Vite warning about it on every
 * build.
 *
 * The cost of that landed on exactly the wrong person. A patient opening
 * the clinic's website to find its phone number downloaded the entire
 * EHR -- the website builder, the document composer, the audit log, the
 * billing screens -- before the address rendered. And a receptionist
 * opening the portal on a phone at the front desk downloaded all of it
 * before the login field appeared.
 *
 * Because the hostname decides the route tree at runtime, Vite cannot
 * know which half to keep; a dynamic import is the only thing that
 * splits them. So the patient site now ships the patient site.
 *
 * Two deliberate exceptions, both eager:
 *
 *   - `Login` is the first thing an unauthenticated visitor to the
 *     portal sees, every time. Splitting it would buy nothing and cost a
 *     second round trip on the most common cold start.
 *   - `Layout` is the shell. It is on screen for the whole session, so
 *     deferring it would only delay the thing that frames everything
 *     else.
 *
 * The named-export `.then()` dance is the price of `export function
 * Dashboard` rather than a default export. Written out rather than hidden
 * behind a helper, because Vite's bundler has to see a literal path in
 * each `import()` to split on it at all.
 */
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Queue = lazy(() => import('./pages/Queue').then((m) => ({ default: m.Queue })));
const Patients = lazy(() => import('./pages/Patients').then((m) => ({ default: m.Patients })));
const PatientDetail = lazy(() => import('./pages/PatientDetail').then((m) => ({ default: m.PatientDetail })));
const Encounter = lazy(() => import('./pages/Encounter').then((m) => ({ default: m.Encounter })));
const Staff = lazy(() => import('./pages/Staff').then((m) => ({ default: m.Staff })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Pharmacy = lazy(() => import('./pages/Pharmacy').then((m) => ({ default: m.Pharmacy })));
const Reminders = lazy(() => import('./pages/Reminders').then((m) => ({ default: m.Reminders })));
const Billing = lazy(() => import('./pages/Billing').then((m) => ({ default: m.Billing })));
const Labs = lazy(() => import('./pages/Labs').then((m) => ({ default: m.Labs })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Expenses = lazy(() => import('./pages/Expenses').then((m) => ({ default: m.Expenses })));
const Website = lazy(() => import('./pages/Website').then((m) => ({ default: m.Website })));

const PublicQueue = lazy(() => import('./pages/PublicQueue').then((m) => ({ default: m.PublicQueue })));
const PublicClinic = lazy(() => import('./pages/PublicClinic').then((m) => ({ default: m.PublicClinic })));
const PublicBlog = lazy(() => import('./pages/PublicBlog').then((m) => ({ default: m.PublicBlog })));
const PublicBlogPost = lazy(() => import('./pages/PublicBlogPost').then((m) => ({ default: m.PublicBlogPost })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useClinicAuth();
  if (isLoading) return <div className="min-h-screen bg-background"><SkeletonPage label="Loading your clinic" /></div>;
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
      {/* Lands here rather than on the queue. The queue answers "who is
          next" and nothing else; between patients the question is
          usually something else entirely. */}
      <Route index path="/" element={<Dashboard />} />
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
  // Read here, not at module scope: TenantGate renders nothing until the
  // directory has said which site this hostname is, and that answer has
  // to be in before the router tree is chosen.
  const mode = siteMode();
  return (
    <ThemeProvider>
      <ToastProvider>
      <ClinicAuthProvider>
        <BrowserRouter>
          {/*
            The outer boundary, for the screens that are not inside the
            portal shell: the login form, the waiting-room display and
            every page of the patient website. Inside the shell the
            boundary sits around <Outlet /> in Layout instead, so that
            navigating the portal never blanks the sidebar you are
            navigating with.
          */}
          <Suspense fallback={<div className="min-h-screen bg-background"><SkeletonPage label="Loading" /></div>}>
            <Routes>
              {mode === 'public' && publicRoutes()}
              {mode === 'portal' && portalRoutes()}
              {mode === 'both' && [
                // Single-domain / development: the patient site keeps its
                // /clinic path so both fit on one origin, exactly as before.
                <Route key="clinic" path="/clinic" element={<PublicClinic />} />,
                <Route key="blog" path="/blog" element={<PublicBlog />} />,
                <Route key="post" path="/blog/:slug" element={<PublicBlogPost />} />,
                ...portalRoutes(),
              ]}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ClinicAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
