import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Category, DEFAULT_CATEGORIES } from '../types';

/**
 * As categorias padrão (Dentista, Home Care, etc.) não ficam gravadas no
 * Firestore — elas são combinadas no cliente com as categorias personalizadas
 * que vendedores/gestores cadastrarem (ver allCategoryNames). Isso evita
 * duplicidade e corrida entre vários usuários tentando "semear" os mesmos
 * documentos ao mesmo tempo.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Erro ao carregar categorias', err);
        setError('Não foi possível carregar as categorias. Tentando novamente...');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { categories, loading, error };
}

export async function addCategory(name: string, uid: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Informe um nome para a categoria.');
  await addDoc(collection(db, 'categories'), {
    name: trimmed,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', id));
}

/** Lista de categorias em ordem alfabética (pt-BR), com "Outros" sempre por último. */
export function allCategoryNames(categories: Category[]): string[] {
  const names = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES.filter((n) => n !== 'Outros'),
      ...categories.map((c) => c.name).filter((n) => n !== 'Outros'),
    ])
  );
  names.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  return [...names, 'Outros'];
}