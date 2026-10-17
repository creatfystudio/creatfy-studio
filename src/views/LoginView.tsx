import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginView() {
  const { login, loginError, clearLoginError, resetPassword, unauthorized } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearLoginError();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // mensagem já tratada pelo AuthContext
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      setResetError('Não foi possível enviar o e-mail de redefinição. Confira o endereço digitado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="stack" style={{ alignItems: 'center', marginBottom: 22 }}>
          <img
            src="/icone-creatfy-v3.png"
            alt="Logo Creatfy Studio"
            width={46}
            height={46}
            style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', display: 'block' }}
          />
          <h2 style={{ marginTop: 12, letterSpacing: '-0.02em' }}>Creatfy Studio</h2>
          <p className="text-sm">Gestão Profissional de Vídeos</p>
        </div>

        {unauthorized && (
          <div className="banner banner-error" style={{ marginBottom: 16 }}>
            Acesso não autorizado. Fale com o Gestor Mestre para liberar seu cadastro.
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>E-mail</label>
              <input
                className="input"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </div>
            <div className="field">
              <label>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginError && <div className="banner banner-error" style={{ marginBottom: 16 }}>{loginError}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMode('reset');
                  setResetSent(false);
                  setResetError(null);
                }}
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p className="text-sm" style={{ marginBottom: 14 }}>
              Informe seu e-mail cadastrado para receber o link de redefinição de senha.
            </p>
            <div className="field">
              <label>E-mail</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {resetSent && (
              <div className="banner banner-success" style={{ marginBottom: 16 }}>
                E-mail de redefinição enviado! Confira sua caixa de entrada.
              </div>
            )}
            {resetError && <div className="banner banner-error" style={{ marginBottom: 16 }}>{resetError}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar e-mail de redefinição'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('login')}>
                Voltar para o login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}