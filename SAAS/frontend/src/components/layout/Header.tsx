import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, MessageSquare, LogOut, ExternalLink, Menu } from 'lucide-react';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const { dna } = useBusiness();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Dashboard';
    const path = location.pathname.split('/')[1];
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Left: Breadcrumbs & Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
            className="mobile-only"
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {location.pathname === '/' ? `${greeting}, ${user?.name?.split(' ')[0] || 'User'}` : getPageTitle()}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            {location.pathname === '/' ? `${dna?.name || 'My Business'} · Live Command Center` : `BusinessOS / ${getPageTitle()}`}
          </p>
        </div>
      </div>

      {/* Right: Quick Search, Theme Toggle, WhatsApp Live, & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        
        {/* Quick Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '6px 12px',
            width: '200px',
          }}
          className="desktop-only"
        >
          <Search size={14} color="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="Search orders, items..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%',
            }}
          />
          <span style={{ fontSize: '11px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
            ⌘K
          </span>
        </div>

        {/* Live WhatsApp Status */}
        <button
          onClick={() => navigate('/conversations')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ecfdf5',
            border: '1px solid #10b981',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#10b981',
            cursor: 'pointer',
          }}
          className="desktop-only"
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          <span>WhatsApp Live</span>
        </button>

        {/* View Storefront Shortcut */}
        <button
          onClick={() => navigate('/website')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          className="desktop-only"
        >
          <ExternalLink size={14} />
          <span>Website</span>
        </button>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
