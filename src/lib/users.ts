import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { db, getSecondaryAuth } from './firebase';
import type { AppUser, UserLevel } from '../types';

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Erro ao carregar usuários', err);
        setError('Não foi possível carregar a lista de usuários.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { users, loading, error };
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  level: UserLevel;
}

/**
 * Cria a conta de autenticação e o cadastro no Firestore usando uma
 * instância SECUNDÁRIA do Firebase, para que o Gestor Mestre não seja
 * deslogado durante o processo.
 */
export async function createUserAccount(input: CreateUserInput, createdByName: string): Promise<string> {
  const secondaryAuth = getSecondaryAuth();
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email.trim(), input.password);
    const uid = credential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      name: input.name.trim(),
      email: input.email.trim(),
      level: input.level,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: createdByName,
    });
    return uid;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
}

export async function updateUserProfile(uid: string, fields: { name?: string; level?: UserLevel }): Promise<void> {
  await updateDoc(doc(db, 'users', uid), fields);
}

export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active });
}

/**
 * "Exclui" o usuário: remove o cadastro do Firestore (bloqueando o acesso
 * imediatamente). O Firebase Auth não permite apagar contas de terceiros
 * direto do navegador — para remover a conta de autenticação por completo,
 * use o Console do Firebase.
 */
export async function deleteUserRecord(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

export async function sendResetPasswordEmail(email: string): Promise<void> {
  const { auth } = await import('./firebase');
  await sendPasswordResetEmail(auth, email.trim());
}
