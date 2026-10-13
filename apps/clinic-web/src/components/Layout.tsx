import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarClock, Users, UserCog, LogOut, Stethoscope, BarChart3, Pill, Bell,
  IndianRupee, FlaskConical, Radio, Settings as SettingsIcon, Globe, Wallet,
  ShieldCheck, LayoutTemplate, Sun, Moon, Menu, X, ExternalLink, LayoutDashboard} from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { publicSiteUrl } from '../lib/site-mode';
import { apiFetch } from '../lib/api';
import { SetupPrompt } from './SetupPrompt';

const ROLE_COLORS: Record<string, string> = {
  DOCTOR: 'bg-emerald-500/15 text-emerald-400',
  ADMIN: 'bg-emerald-500/15 text-emerald-400',
  NURSE: 'bg-blue-500/15 text-blue-400',
  RECEPTIONIST: 'bg-amber-500/15 text-amber-400',
  PHARMACIST: 'bg-purple-500/15 text-purple-400',
};

const PHARMACY_ROLES = new Set(['PHARMACIST', 'DOCTOR', 'ADMIN']);
const BILLING_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);
const ADMIN_ROLES = new Set(['DOCTOR', 'ADMIN']);
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
  const { user, clinicName, enabledFeatures, logout } = useClinicAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [dueReminders, setDueReminders] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await apiFetch<{ due: number }>('/reminders');
        setDueReminders(res.due);
      } catch {
        // silent -- a failed poll shouldn't disrupt the rest of the app
      }
    };
    poll();
    const interval = setInterval(poll, REMINDER_POLL_MS);
    return () => clearInterval(interval);
  }, []);

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

  const navItems = (
    <>
      <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
      <NavItem to="/queue" icon={CalendarClock} label="Today&rsquo;s Queue" />
      <NavItem to="/patients" icon={Users} label="Patients" />
      <NavItem to="/reminders" icon={Bell} label="Reminders" badge={dueReminders} />
      <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
      {user && BILLING_ROLES.has(user.role) && <NavItem to="/billing" icon={IndianRupee} label="Billing" />}
      {user && BILLING_ROLES.has(user.role) && <NavItem to="/expenses" icon={Wallet} label="Expenses" />}
      {user && PHARMACY_ROLES.has(user.role) && <NavItem to="/pharmacy" icon={Pill} label="Pharmacy" />}
      <NavItem to="/labs" icon={FlaskConical} label="Labs" />
      {user && ADMIN_ROLES.has(user.role) && <NavItem to="/website" icon={LayoutTemplate} label="Website" />}
      {user && ADMIN_ROLES.has(user.role) && <NavItem to="/audit" icon={ShieldCheck} label="Audit Log" />}
      <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
      {enabledFeatures.staff && <NavItem to="/staff" icon={UserCog} label="Staff" />}

      <div className="my-2 border-t border-border/10" />
      <ExternalNavItem href={publicSiteUrl('/live-queue')} icon={Radio} label="Live Queue Display" />
      <ExternalNavItem href={publicSiteUrl('/')} icon={Globe} label="Public Clinic Page" />
    </>
  );

  const userFooter = (
    <div className="border-t border-border/10 pt-3 mt-3">
      <div className="px-2 mb-2">
        <div className="text-xs font-medium text-foreground truncate">{user?.name}</div>
        {user && (
          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_COLORS[user.role] || 'bg-foreground/10 text-foreground/80'}`}>
            {user.role}
          </span>
        )}
      </div>
      <button onClick={logout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-foreground/10 w-full">
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-14 border-b border-border/10 bg-background/95 backdrop-blur"
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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Stethoscope size={17} className="text-emerald-400 shrink-0" />
          <span className="font-bold text-sm tracking-tight truncate" title={clinicName || 'Clinic Portal'}>{clinicName || 'Clinic Portal'}</span>
        </div>
        <IconButtons theme={theme} toggleTheme={toggleTheme} dueReminders={dueReminders} onBell={() => navigate('/reminders')} />
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside
            className="relative w-[82%] max-w-[300px] bg-background border-r border-border/10 flex flex-col p-4 overflow-y-auto"
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2 min-w-0">
                <Stethoscope size={18} className="text-emerald-400 shrink-0" />
                <span className="font-bold text-sm truncate">{clinicName || 'Clinic Portal'}</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 -mr-1 rounded-lg text-muted-foreground hover:bg-foreground/10" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 flex-1">{navItems}</nav>
            {userFooter}
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-border/10 flex-col p-4 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-8 px-2">
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope size={20} className="text-emerald-400 shrink-0" />
            <span className="font-bold text-sm tracking-tight truncate" title={clinicName || 'Clinic Portal'}>{clinicName || 'Clinic Portal'}</span>
          </div>
          <IconButtons theme={theme} toggleTheme={toggleTheme} dueReminders={dueReminders} onBell={() => navigate('/reminders')} />
        </div>
        <nav className="flex flex-col gap-1 flex-1">{navItems}</nav>
        {userFooter}
      </aside>

      {/* min-w-0 stops a wide table inside from stretching the flex row and
          pushing the sidebar off screen. */}
      <main className="flex-1 min-w-0">
        {/* Above every portal screen, because the person who can fill in
            the clinic's website did not come here to look at it. */}
        <SetupPrompt />
        <Outlet />
      </main>
    </div>
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
          <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-foreground text-[11px] leading-none font-bold flex items-center justify-center">
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
        `flex items-center gap-2.5 px-3 min-h-[44px] md:min-h-0 md:py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-foreground text-background' : 'text-foreground/80 hover:bg-foreground/10'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate" title={label}>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
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
      className="flex items-center gap-2.5 px-3 min-h-[44px] md:min-h-0 md:py-2 rounded-lg text-sm font-medium text-foreground/80 hover:bg-foreground/10"
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate" title={label}>{label}</span>
      <ExternalLink size={11} className="ml-auto text-muted-foreground/60 shrink-0" />
    </a>
  );
}
