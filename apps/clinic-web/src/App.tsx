import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClinicAuthProvider, useClinicAuth } from './contexts/ClinicAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { SkeletonPage } from './components/Skeleton';
import { siteMode } from './lib/site-mode';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { NotInPlan } from './components/NotInPlan';

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
const Requests = lazy(() => import('./pages/Requests').then((m) => ({ default: m.Requests })));
const Billing = lazy(() => import('./pages/Billing').then((m) => ({ default: m.Billing })));
const Labs = lazy(() => import('./pages/Labs').then((m) => ({ default: m.Labs })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Expenses = lazy(() => import('./pages/Expenses').then((m) => ({ default: m.Expenses })));
const Website = lazy(() => import('./pages/Website').then((m) => ({ default: m.Website })));
const Ipd = lazy(() => import('./pages/Ipd').then((m) => ({ default: m.Ipd })));
const AdmissionPage = lazy(() => import('./pages/Admission').then((m) => ({ default: m.AdmissionPage })));
const Counter = lazy(() => import('./pages/Counter').then((m) => ({ default: m.Counter })));
const Claims = lazy(() => import('./pages/Claims').then((m) => ({ default: m.Claims })));
const ClaimPage = lazy(() => import('./pages/Claims').then((m) => ({ default: m.ClaimPage })));
const Ot = lazy(() => import('./pages/Wards').then((m) => ({ default: m.Ot })));
const Radiology = lazy(() => import('./pages/Wards').then((m) => ({ default: m.Radiology })));
const Nursing = lazy(() => import('./pages/Wards').then((m) => ({ default: m.Nursing })));
const Departments = lazy(() => import('./pages/Wards').then((m) => ({ default: m.Departments })));

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

/** A screen that belongs to a module. Off, it says which plan includes
 *  it and who to ask, instead of bouncing to the queue as if the link
 *  were broken. */
function ModuleRoute({ module, children }: { module: string; children: React.ReactNode }) {
  const { hasModule } = useClinicAuth();
  if (!hasModule(module)) return <NotInPlan module={module} />;
  return <>{children}</>;
}

/** Claims belong to two desks; either one being on opens the screen. */
function ClaimsRoute({ children }: { children: React.ReactNode }) {
  const { hasModule } = useClinicAuth();
  if (!hasModule('insurance') && !hasModule('schemes')) return <NotInPlan module="insurance" />;
  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  return <ModuleRoute module="staff">{children}</ModuleRoute>;
}

const PHARMACY_ROLES = new Set(['PHARMACIST', 'DOCTOR', 'ADMIN']);

function PharmacyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !PHARMACY_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

// The hospital's cashier and billing clerk bill too; the API's billing set
// includes both, and the menu offers them Billing.
const BILLING_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'CASHIER', 'BILLING_CLERK']);
// Expenses are the clinic's own spending, not bills: the API keeps them to
// the original three, so the route does too.
const EXPENSE_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);

function ExpenseRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useClinicAuth();
  if (!user || (!EXPENSE_ROLES.has(user.role) && !isAdmin)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Appointment requests carry names and phone numbers typed in by people
 *  who are not yet patients. Front-desk work, and the same set the API
 *  enforces -- this only hides the screen, the server refuses the data. */
const FRONT_DESK_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);

function FrontDeskRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !FRONT_DESK_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

function BillingRoute({ children }: { children: React.ReactNode }) {
  const { user } = useClinicAuth();
  if (!user || !BILLING_ROLES.has(user.role)) return <Navigate to="/queue" replace />;
  return <>{children}</>;
}

/**
 * The audit log reveals which staff member looked at which patient, and
 * the website is the clinic's public face: both are for whoever
 * administers the clinic. This only hides the screen; the server refuses
 * the data regardless.
 *
 * On the admin FLAG, as the API and the menu are -- not on the role. It
 * used to check for DOCTOR or ADMIN, which disagreed with both in both
 * directions: a practice manager made admin (a receptionist by role) was
 * shown "Website" and "Audit log" in the menu and bounced to the queue on
 * clicking either, while every doctor who was not an admin could open
 * both screens and be met by a refusal from the server.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useClinicAuth();
  if (!user || !isAdmin) return <Navigate to="/queue" replace />;
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
      <Route path="/requests" element={<FrontDeskRoute><Requests /></FrontDeskRoute>} />
      <Route path="/analytics" element={<ModuleRoute module="analytics"><Analytics /></ModuleRoute>} />
      <Route path="/pharmacy" element={<ModuleRoute module="pharmacy"><PharmacyRoute><Pharmacy /></PharmacyRoute></ModuleRoute>} />
      <Route path="/labs" element={<ModuleRoute module="labs"><Labs /></ModuleRoute>} />
      <Route path="/billing" element={<ModuleRoute module="billing"><BillingRoute><Billing /></BillingRoute></ModuleRoute>} />
      <Route path="/expenses" element={<ModuleRoute module="expenses"><ExpenseRoute><Expenses /></ExpenseRoute></ModuleRoute>} />
      <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />
      <Route path="/website" element={<AdminRoute><Website /></AdminRoute>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/staff" element={<StaffRoute><Staff /></StaffRoute>} />
      {/* Hospital desks. Each is its own module; the API also checks the
          role on every call, so these only decide what renders. */}
      <Route path="/ipd" element={<ModuleRoute module="ipd"><Ipd /></ModuleRoute>} />
      <Route path="/ipd/:id" element={<ModuleRoute module="ipd"><AdmissionPage /></ModuleRoute>} />
      <Route path="/nursing" element={<ModuleRoute module="nursing"><ModuleRoute module="ipd"><Nursing /></ModuleRoute></ModuleRoute>} />
      <Route path="/ot" element={<ModuleRoute module="ot"><Ot /></ModuleRoute>} />
      <Route path="/radiology" element={<ModuleRoute module="radiology"><Radiology /></ModuleRoute>} />
      <Route path="/counter" element={<ModuleRoute module="cashcounter"><Counter /></ModuleRoute>} />
      <Route path="/claims" element={<ClaimsRoute><Claims /></ClaimsRoute>} />
      <Route path="/claims/:id" element={<ClaimsRoute><ClaimPage /></ClaimsRoute>} />
      <Route path="/departments" element={<ModuleRoute module="departments"><Departments /></ModuleRoute>} />
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
