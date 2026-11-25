import { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarClock, Users, UserCog, LogOut, BarChart3, Pill, Bell,
  IndianRupee, FlaskConical, Radio, Settings as SettingsIcon, Globe, Wallet,
  ShieldCheck, LayoutTemplate, Sun, Moon, Menu, X, ExternalLink, LayoutDashboard,
  CalendarCheck, BedDouble, HeartPulse, Scissors, ScanLine, Landmark, FileCheck2, Building2} from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { publicSiteUrl } from '../lib/site-mode';
import { apiFetch } from '../lib/api';
import { usePolling } from '../lib/usePolling';
import { areasFor, type Area } from '../lib/areas';
import { SetupPrompt } from './SetupPrompt';
import { QuickSwitcher } from './QuickSwitcher';
import { SkeletonPage } from './Skeleton';
import { ScribeProvider } from '../contexts/ScribeContext';
import { AssistantBar } from './AssistantBar';

/** How a role reads in the sidebar: a word, not a code. */
const ROLE_WORDS: Record<string, string> = {
  DOCTOR: 'Doctor',
  ADMIN: 'Clinic admin',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Reception',
  PHARMACIST: 'Pharmacist',
  CASHIER: 'Cashier',
  BILLING_CLERK: 'Billing',
  LAB_TECH: 'Lab technician',
  RADIOGRAPHER: 'Radiographer',
};

// Admin screens are gated on the isAdmin FLAG, not on being a doctor; the
// rest of the menu comes from lib/areas.ts -- role plus the desks someone
// is assigned to.
const FRONT_DESK_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);
const REMINDER_POLL_MS = 60_000;

/**
 * Portal shell.
 *
 * The nav was previously one horizontally-scrolling strip on small screens:
 * twelve items in a 375px-wide row, so reaching Settings meant swiping past
 * everything else and the active item was usually off-screen. Reception
 * works from a phone at the front desk, so that was the layout that
 * mattered most and broke worst.
 *
 * Now: a real top bar plus a slide-over drawer below `md`, and the familiar
 * fixed sidebar at `md` and up. Drawer targets are at least 44px tall,
 * which is about the smallest a fingertip hits reliably one-handed.
 */
export function Layout() {
  const { user, clinicName, enabledFeatures, entitlement, hasModule, isAdmin, logout } = useClinicAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [dueReminders, setDueReminders] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [servicePoints, setServicePoints] = useState<string[]>([]);

  // The desks this person works at add screens to their menu. Only asked
  // when the hospital has departments; a clinic without them has none.
  const departmentsOn = hasModule('departments');
  useEffect(() => {
    if (!departmentsOn || !user) { setServicePoints([]); return; }
    apiFetch<{ servicePoints: string[] }>('/departments/mine')
      .then((r) => setServicePoints(r.servicePoints))
      .catch(() => setServicePoints([]));
  }, [departmentsOn, user]);

  usePolling(async () => {
    try {
      const res = await apiFetch<{ due: number }>('/reminders');
      setDueReminders(res.due);
    } catch {
      // silent -- a failed poll shouldn't disrupt the rest of the app
    }
  }, REMINDER_POLL_MS);

  // Only for the roles the API will answer: a nurse polling this would
  // collect a 403 every minute and log a failure that is not one.
  // `take=1` because only the count is wanted here, not the list.
  usePolling(async () => {
    if (!user || !FRONT_DESK_ROLES.has(user.role)) return;
    try {
      const res = await apiFetch<{ newCount: number }>('/appointment-requests?status=NEW&take=1');
      setNewRequests(res.newCount);
    } catch {
      // silent, same reasoning as above
    }
  }, REMINDER_POLL_MS);

  // Navigating must dismiss the drawer, or tapping a link leaves it covering
  // the page you just asked for.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Scroll-lock the body while the drawer is open -- otherwise the page
  // behind it scrolls under your finger, which is disorienting on iOS.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  // Escape closes it, as a keyboard user expects of any overlay.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const areas = areasFor(user?.role, isAdmin, servicePoints, hasModule);
  const sees = (a: Area) => areas.has(a);
  const inpatients = sees('ipd') || sees('nursing') || sees('ot');
  const clinical = sees('labs') || sees('radiology') || sees('pharmacy');
  const money = sees('billing') || sees('counter') || sees('claims') || sees('expenses') || sees('reports');
  const navItems = (
    <>
      <NavGroup>
        {sees('queue') && <NavItem to="/queue" icon={CalendarClock} label="Queue" />}
        <NavItem to="/" icon={LayoutDashboard} label="Overview" />
        {sees('requests') && <NavItem to="/requests" icon={CalendarCheck} label="Booking requests" badge={newRequests} />}
        {sees('queue') && <NavItem to="/reminders" icon={Bell} label="Follow-ups due" badge={dueReminders} />}
      </NavGroup>
      <NavGroup caption="Patients">
        <NavItem to="/patients" icon={Users} label="All patients" />
      </NavGroup>
      {inpatients && (
        <NavGroup caption="Inpatients">
          {sees('ipd') && <NavItem to="/ipd" icon={BedDouble} label="Bed board" />}
          {sees('nursing') && <NavItem to="/nursing" icon={HeartPulse} label="Nursing" />}
          {sees('ot') && <NavItem to="/ot" icon={Scissors} label="Operation theatre" />}
        </NavGroup>
      )}
      {clinical && (
        <NavGroup caption="Clinical">
          {sees('labs') && <NavItem to="/labs" icon={FlaskConical} label="Lab orders" />}
          {sees('radiology') && <NavItem to="/radiology" icon={ScanLine} label="Radiology" />}
          {sees('pharmacy') && <NavItem to="/pharmacy" icon={Pill} label="Pharmacy" />}
        </NavGroup>
      )}
      {money && (
        <NavGroup caption="Money">
          {sees('counter') && <NavItem to="/counter" icon={Landmark} label="Cash counter" />}
          {sees('billing') && <NavItem to="/billing" icon={IndianRupee} label="Billing" />}
          {sees('claims') && <NavItem to="/claims" icon={FileCheck2} label="Claims" />}
          {sees('expenses') && <NavItem to="/expenses" icon={Wallet} label="Expenses" />}
          {sees('reports') && <NavItem to="/analytics" icon={BarChart3} label="Reports" />}
        </NavGroup>
      )}
      <NavGroup caption="Clinic">
        {sees('departments') && <NavItem to="/departments" icon={Building2} label="Departments" />}
        {isAdmin && <NavItem to="/website" icon={LayoutTemplate} label="Website" />}
        {/* The staff list is admin-only in the API; showing it to everyone
            only led them to a refusal. */}
        {isAdmin && enabledFeatures.staff && <NavItem to="/staff" icon={UserCog} label="Staff" />}
        <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
        {isAdmin && <NavItem to="/audit" icon={ShieldCheck} label="Audit log" />}
      </NavGroup>
      <NavGroup caption="Open in a new tab">
        <ExternalNavItem href={publicSiteUrl('/live-queue')} icon={Radio} label="Waiting-room screen" />
        <ExternalNavItem href={publicSiteUrl('/')} icon={Globe} label="Clinic website" />
      </NavGroup>
    </>
  );

  const userFooter = (
    <div className="border-t border-border/15 pt-3 mt-4">
      <div className="px-3 mb-1.5">
        <div className="text-[14px] font-semibold text-foreground truncate">{user?.name}</div>
        {user && <div className="text-[13px] text-muted-foreground">{ROLE_WORDS[user.role] || user.role}</div>}
      </div>
      <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground w-full">
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );

  return (
    // The assistant's recorder is held here, in the shell, because the
    // shell is the one thing on screen for the whole session: a doctor
    // who leaves the visit page to look at a history must not end the
    // listening by doing so. See contexts/ScribeContext.tsx.
    <ScribeProvider>
    <div className="portal min-h-screen bg-background text-foreground md:flex">
      {/*
        Past the nav, in one key.

        The sidebar holds twelve destinations, and without this a keyboard
        or screen-reader user tabbed through all twelve to reach the content
        of every single screen -- then through them again on the next one.
        The patient site has had a skip link since it was built; the portal,
        which is the thing staff use all day, did not.

        Visible only when focused, so it costs nothing to anyone using a
        mouse. It is the first element in the DOM because a skip link that
        is not first is a link you have to tab to in order to skip tabbing.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-14 border-b border-border/15 bg-background/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2.5 -ml-1 rounded-lg text-foreground/80 hover:bg-foreground/10"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <ClinicMark name={clinicName} compact />
        </div>
        <IconButtons theme={theme} toggleTheme={toggleTheme} dueReminders={dueReminders} onBell={() => navigate('/reminders')} />
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside
            className="relative w-[82%] max-w-[300px] bg-background shadow-overlay border-r border-border/15 flex flex-col px-3 py-4 overflow-y-auto"
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-start justify-between gap-2 mb-5 px-2">
              <ClinicMark name={clinicName} />
              <button onClick={() => setDrawerOpen(false)} className="p-2 -mr-1 rounded-lg text-muted-foreground hover:bg-foreground/10" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col flex-1">{navItems}</nav>
            {userFooter}
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-border/15 bg-background flex-col px-3 py-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-5 px-2">
          <ClinicMark name={clinicName} />
          <IconButtons theme={theme} toggleTheme={toggleTheme} dueReminders={dueReminders} onBell={() => navigate('/reminders')} />
        </div>
        <nav className="flex flex-col flex-1">{navItems}</nav>
        {userFooter}
      </aside>

      {/* min-w-0 stops a wide table inside from stretching the flex row and
          pushing the sidebar off screen. */}
      {/* Room at the foot of every screen for the assistant's bar, so the
          last row of a table or the Save button of a form is never
          underneath it. */}
      <main id="main" data-readonly={entitlement.readOnly ? '' : undefined} className={`flex-1 min-w-0 ${hasModule('scribe') ? 'pb-24' : ''}`}>
        <AccountBanner readOnly={entitlement.readOnly} demo={entitlement.demo} contact={entitlement.upgradeContact} />
        {/* Above every portal screen, because the person who can fill in
            the clinic's website did not come here to look at it. */}
        {/* Only an admin can fill the website in, so only an admin is
            asked to; a cashier cannot act on it. */}
        {/* And only on the screens where an admin is looking after the
            clinic, not the ones where a doctor is looking after a patient:
            on a visit it pushed the patient's name a third of the way
            down the screen. */}
        {isAdmin && ['/', '/website', '/settings'].includes(location.pathname) && <SetupPrompt />}
        {/*
          Every portal screen is a separate chunk (see App.tsx), so the
          first visit to one has to wait for it. The boundary belongs
          HERE rather than around <Routes>: at the router level the
          fallback would replace the shell too, so the sidebar and the
          clinic's name would vanish for the moment it took to fetch the
          page -- and the nav you had just clicked would disappear under
          your cursor. Scoped to <main>, the shell holds still and only
          the content area fills in.
        */}
        <Suspense fallback={<SkeletonPage label="Loading this screen" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Overlays everything, so it is mounted on the shell rather than
          inside a page. Ctrl+K from any screen. */}
      <QuickSwitcher />
      <AssistantBar />
    </div>
    </ScribeProvider>
  );
}

function IconButtons({ theme, toggleTheme, dueReminders, onBell }: {
  theme: string; toggleTheme: () => void; dueReminders: number; onBell: () => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10"
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button
        onClick={onBell}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10"
        title="Follow-up reminders"
        aria-label="Follow-up reminders"
      >
        <Bell size={16} />
        {dueReminders > 0 && (
          <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] leading-none font-bold flex items-center justify-center">
            {dueReminders}
          </span>
        )}
      </button>
    </div>
  );
}

/** 44px minimum on touch screens; the tighter desktop padding returns at
 * `md`, where a pointer is precise and vertical space is scarcer. */
function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      // `end` for the dashboard only. Without it a link to "/" is active
      // on every route, because react-router treats it as a prefix match
      // -- so the whole nav would look like the dashboard was open while
      // you were on Billing.
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 min-h-[44px] md:min-h-0 md:py-[7px] rounded-lg text-[14px] transition-colors ${
          isActive
            ? 'bg-accent text-foreground font-semibold'
            : 'font-medium text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate" title={label}>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function ExternalNavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 min-h-[44px] md:min-h-0 md:py-[7px] rounded-lg text-[14px] font-medium text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground"
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate" title={label}>{label}</span>
      <ExternalLink size={11} className="ml-auto text-muted-foreground/60 shrink-0" />
    </a>
  );
}

/** A labelled group in the sidebar; the first group has no caption. */
function NavGroup({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      {caption && <p className="mb-1 px-3 text-[12px] font-medium text-muted-foreground">{caption}</p>}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/** The clinic's own name, set like Nayaverse Growth's mark. */
function ClinicMark({ name, compact }: { name?: string | null; compact?: boolean }) {
  const label = name || 'Clinic portal';
  return (
    <div className="min-w-0 leading-none" title={label}>
      <span className={`block font-semibold uppercase tracking-[0.12em] text-muted-foreground ${compact ? 'text-[10px]' : 'text-[11px]'}`}>Nayaversse Clinic</span>
      {/* Two lines in the sidebar: a hospital's name is long ("Sai
          Multispeciality Hospital") and cut to "SAI MULTISPECI…" it is not
          the name. The phone bar stays one line. */}
      <span className={`block font-display font-semibold uppercase tracking-[0.02em] text-foreground ${compact ? 'mt-0.5 truncate text-[17px]' : 'mt-1 line-clamp-2 text-[19px] leading-[1.1]'}`}>{label}</span>
    </div>
  );
}

/**
 * The account's state, above every screen, when it is not the normal one.
 *
 * Read-only says what still works before what does not: a receptionist
 * who finds the Save button refusing needs to know the records are all
 * still there. Demo says the patients are made up, so nobody mistakes a
 * demonstration for a real clinic's data or types a real patient into it.
 */
function AccountBanner({ readOnly, demo, contact }: { readOnly: boolean; demo: boolean; contact: string | null }) {
  if (!readOnly && !demo) return null;
  return (
    <div className="px-4 pt-4 sm:px-6 md:px-8">
      {readOnly && (
        <div role="status" className="rounded-xl tone-warning tone-block px-4 py-3 text-[14px]">
          <p className="font-semibold">This clinic's account is paused.</p>
          <p className="mt-0.5">Every record can still be viewed, printed and exported. Nothing can be added or changed until it is resumed.{contact ? ` Contact ${contact}.` : ''}</p>
        </div>
      )}
      {demo && !readOnly && (
        <div role="status" className="rounded-xl border border-border/20 bg-accent/60 px-4 py-2.5 text-[14px]">
          <span className="font-semibold">Demo clinic.</span> Every patient here is made up, and the data resets each night. Please do not enter real patient details.
        </div>
      )}
    </div>
  );
}
