import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, MASTER_EMAIL } from '../lib/firebase';
import type { AppUser } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  unauthorized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginError: string | null;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function translateAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    case 'auth/user-disabled':
      return 'Esta conta está desativada.';
    default:
      return 'Não foi possível entrar. Tente novamente.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        // Novo login: limpa qualquer aviso de "acesso não autorizado" anterior.
        setUnauthorized(false);
      } else {
        // Importante: NÃO limpar "unauthorized" aqui. Quando detectamos um
        // cadastro inativo/inexistente, nós mesmos deslogamos o usuário (ver
        // efeito abaixo) — isso dispara este mesmo listener com user=null, e
        // precisamos preservar a mensagem já definida para a tela de login.
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const userRef = doc(db, 'users', firebaseUser.uid);

    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<AppUser, 'uid'>;
          if (!data.active) {
            setUnauthorized(true);
            setProfile(null);
            await firebaseSignOut(auth);
            setLoading(false);
            return;
          }
          setProfile({ uid: firebaseUser.uid, ...data });
          setLoading(false);
          return;
        }

        // Documento não existe: só é permitido para a conta mestre, no primeiro login.
        if (firebaseUser.email?.toLowerCase() === MASTER_EMAIL) {
          try {
            await setDoc(userRef, {
              name: 'Gestor Mestre',
              email: MASTER_EMAIL,
              level: 'manager',
              active: true,
              isMaster: true,
              createdAt: serverTimestamp(),
              createdBy: 'sistema',
            });
          } catch (err) {
            console.error('Falha ao inicializar o Gestor Mestre', err);
            setLoading(false);
          }
          return; // o próprio onSnapshot vai disparar de novo com o doc criado
        }

        setUnauthorized(true);
        setProfile(null);
        await firebaseSignOut(auth);
        setLoading(false);
      },
      async (err) => {
        console.error('Erro ao sincronizar perfil do usuário', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [firebaseUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      setLoginError(translateAuthError(err?.code ?? ''));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, loading, unauthorized, login, logout, resetPassword, loginError, clearLoginError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
