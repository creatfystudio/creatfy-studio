import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Todas as credenciais vêm de variáveis de ambiente (.env).
// Veja .env.example e o README para instruções de configuração.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const MASTER_EMAIL = 'mascotfystudio@gmail.com';

// App principal (sessão do usuário logado)
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Retorna uma instância SECUNDÁRIA do Firebase, usada apenas para criar
 * contas de novos usuários sem derrubar a sessão do Gestor Mestre.
 * Uma nova instância "Secondary" é criada a cada chamada (ou reaproveitada
 * se já existir) para não interferir na sessão principal.
 */
export function getSecondaryAuth(): Auth {
  const secondaryApp =
    getApps().find((a) => a.name === 'Secondary') ??
    initializeApp(firebaseConfig, 'Secondary');
  return getAuth(secondaryApp);
}
