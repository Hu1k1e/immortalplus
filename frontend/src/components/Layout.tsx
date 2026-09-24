
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="content-container animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
