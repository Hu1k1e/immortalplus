
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, Crosshair, Settings as SettingsIcon } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/matches', label: 'Match History', icon: History },
  { path: '/draft', label: 'Draft Helper', icon: Crosshair },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">
          IMMORTAL<span className="accent">+</span>
        </h1>
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
            >
              <item.icon className="nav-icon" size={20} />
              <span>{item.label}</span>
              {isActive && <div className="active-indicator" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="status-indicator">
          <div className="status-dot green"></div>
          <span>GSI Connected</span>
        </div>
      </div>
    </aside>
  );
}
