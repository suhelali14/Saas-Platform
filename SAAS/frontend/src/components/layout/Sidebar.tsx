import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import {
  LayoutDashboard,
  ShoppingCart,
  FolderKanban,
  Users,
  CreditCard,
  UserCog,
  MessageSquare,
  Megaphone,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  Calendar,
  Globe,
  ShieldCheck,
  LifeBuoy,
} from 'lucide-react';

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Bookings', path: '/bookings', icon: Calendar },
      { name: 'Orders', path: '/orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Business',
    items: [
      { name: 'Catalog', path: '/catalog', icon: FolderKanban },
      { name: 'Inventory', path: '/inventory', icon: Boxes },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Employees', path: '/employees', icon: UserCog },
      { name: 'Website', path: '/website', icon: Globe },
    ],
  },
  {
    label: 'Growth',
    items: [
      { name: 'Conversations', path: '/conversations', icon: MessageSquare },
      { name: 'Marketing', path: '/growth', icon: Megaphone },
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Payments', path: '/payments', icon: CreditCard },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Verification', path: '/kyc', icon: ShieldCheck },
      { name: 'Support', path: '/tickets', icon: LifeBuoy },
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { dna } = useBusiness();

  const businessName = dna?.name || 'My Business';

  const renderNavSection = (section: NavSection) => (
    <div key={section.label} style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', padding: '0 12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {section.label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#000000' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.1s ease',
              })}
            >
              <Icon size={16} style={{ color: 'inherit', opacity: 0.8 }} />
              <span style={{ flex: 1 }}>{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 40,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      <aside
        className={`app-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '212px',
          position: 'sticky',
          top: 0,
          fontFamily: 'Inter, sans-serif',
          zIndex: 50,
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
              color: 'var(--bg-primary)',
              flexShrink: 0,
            }}
          >
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {businessName}
          </div>
        </div>

        {/* Nav Sections */}
        <nav style={{ padding: '0 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_SECTIONS.map(renderNavSection)}
        </nav>

        {/* User Footer */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderTop: '1px solid var(--border-color)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bg-primary)',
              fontWeight: 600,
              fontSize: '12px',
              flexShrink: 0,
            }}
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'Account'}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
