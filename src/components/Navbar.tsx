import { Sun, Moon, Laptop, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LEVEL_LABELS } from '../types';

interface NavbarProps {
  onGoHome: () => void;
}

export default function Navbar({ onGoHome }: NavbarProps) {
  const { preference, setPreference } = useTheme();
  const { profile, logout } = useAuth();

  return (
    <header className="navbar">
      <style>{`
        .navbar-home {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: none;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 4px 8px;
          margin-left: -8px;
          cursor: pointer;
          color: inherit;
          font: inherit;
          font-weight: 700;
          transition: background 0.15s, border-color 0.15s;
        }
        .navbar-home:hover {
          background: var(--bg-secondary, rgba(124, 53, 233, 0.08));
          border-color: var(--border, rgba(124, 53, 233, 0.25));
        }
        .navbar-home:focus-visible {
          outline: 2px solid var(--primary, #7c35e9);
          outline-offset: 2px;
        }
      `}</style>

      <div className="navbar-inner">
        <div className="navbar-brand">
          <button type="button" className="navbar-home" onClick={onGoHome} aria-label="Voltar ao início">
            <img
              src="/icone-creatfy-v3.png"
              alt=""
              width={28}
              height={28}
              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', display: 'block' }}
            />
            <span>Creatfy Studio</span>
          </button>
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