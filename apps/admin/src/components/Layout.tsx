import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck, Ticket, LogOut } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export function Layout() {
  const { admin, logout } = useAdminAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-white text-black' : 'text-gray-300 hover:bg-white/10'
    }`;

  return (
    <div className="min-h-screen flex bg-[#0b0d12] text-white">
      <aside className="w-56 border-r border-white/10 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <ShieldCheck size={20} className="text-emerald-400" />
          <span className="font-bold text-sm tracking-tight">Platform Admin</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <NavLink to="/kyc" className={linkClass}>
            <ShieldCheck size={16} /> KYC Review
          </NavLink>
          <NavLink to="/tickets" className={linkClass}>
            <Ticket size={16} /> Tickets
          </NavLink>
        </nav>
        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="text-xs font-medium text-white">{admin?.name}</div>
            <div className="text-[11px] text-gray-400">{admin?.role}</div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 w-full">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
