import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';
import './ThemeToggle.css';

/** Quick dark/light switch living in the top-right header, next to the
 * profile button -- Settings' Appearance section has the same control
 * (plus the accent picker) for people who want it there instead. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className={`theme-toggle ${isLight ? 'is-light' : ''}`}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="theme-toggle-track">
        <Moon size={12} className="theme-toggle-icon theme-toggle-icon-moon" />
        <Sun size={12} className="theme-toggle-icon theme-toggle-icon-sun" />
        <span className="theme-toggle-knob" />
      </span>
    </button>
  );
}
