
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ProfileButton from './ProfileButton';
import ThemeToggle from './ThemeToggle';
import './Layout.css';
import './ProfileButton.css';

export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="app-topbar">
          <ThemeToggle />
          <ProfileButton />
        </div>
        <div className="content-container animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
