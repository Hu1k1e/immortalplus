
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, Crosshair, TrendingUp, Settings as SettingsIcon, ChevronLeft } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/matches', label: 'Match History', icon: History },
  { path: '/draft', label: 'Draft Helper', icon: Crosshair },
  { path: '/meta', label: 'Meta', icon: TrendingUp },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

const COLLAPSE_KEY = 'immortalplus.sidebar.collapsed';

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Link to="/" className="logo">
          <img src="/logo.svg" alt="" className="logo-mark" />
          {!collapsed && (
            <span className="logo-text">
              Immortal<span className="accent">+</span>
            </span>
          )}
        </Link>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
                          (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="nav-icon" size={20} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && <div className="active-indicator" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="status-indicator" title={collapsed ? 'GSI Connected' : undefined}>
          <div className="status-dot green"></div>
          {!collapsed && <span>GSI Connected</span>}
        </div>
      </div>
      <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <ChevronLeft size={14} className={collapsed ? 'flipped' : ''} />
      </button>
    </aside>
  );
}
