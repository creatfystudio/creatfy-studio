import { Sun, Moon, Laptop, LogOut } from 'lucide-react';
import MascotfyLogo from './CreatfyLogo';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LEVEL_LABELS } from '../types';

export default function Navbar() {
  const { preference, setPreference } = useTheme();
  const { profile, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <MascotfyLogo size={28} />
        </div>
        <div className="row gap-md">
          <div className="theme-toggle" role="group" aria-label="Alternar tema">
            <button
              className={preference === 'light' ? 'active' : ''}
              onClick={() => setPreference('light')}
              title="Claro"
              aria-label="Tema claro"
            >
              <Sun size={15} />
            </button>
            <button
              className={preference === 'dark' ? 'active' : ''}
              onClick={() => setPreference('dark')}
              title="Escuro"
              aria-label="Tema escuro"
            >
              <Moon size={15} />
            </button>
            <button
              className={preference === 'auto' ? 'active' : ''}
              onClick={() => setPreference('auto')}
              title="Automático"
              aria-label="Tema automático"
            >
              <Laptop size={15} />
            </button>
          </div>

          {profile && (
            <div className="navbar-user hide-mobile">
              <div>
                <strong>{profile.name}</strong>
                <div>{LEVEL_LABELS[profile.level]}</div>
              </div>
            </div>
          )}

          <button className="btn btn-secondary btn-sm" onClick={logout}>
            <LogOut size={15} />
            <span className="hide-mobile">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
