import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from '../types';
import { useAuth } from '../contexts/AuthContext';

/**
 * Assina a coleção "orders" em tempo real, já filtrada conforme o nível do
 * usuário logado (vendedor só vê os próprios pedidos). Lida com erros de
 * rede/sessão sem quebrar a tela: mostra mensagem amigável e permite
 * tentar de novo.
 */
export function useOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const base = collection(db, 'orders');
    const q =
      profile.level === 'seller'
        ? query(base, where('sellerId', '==', profile.uid), orderBy('createdAt', 'desc'))
        : query(base, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Erro ao sincronizar pedidos', err);
        setError('Não foi possível carregar os pedidos agora. Verifique sua conexão.');
        setLoading(false);
      }
    );

    return unsub;
  }, [profile, retryCount]);

  return { orders, loading, error, retry };
}
