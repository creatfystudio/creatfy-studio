import type { Timestamp } from 'firebase/firestore';

export type UserLevel = 'seller' | 'creator' | 'manager';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  level: UserLevel;
  active: boolean;
  createdAt: Timestamp | null;
  createdBy: string;
  isMaster?: boolean;
}

export type OrderStatus = 'pending' | 'production' | 'ready' | 'delivered';

export interface VideoItem {
  index: number;
  script: string;
  videoUrl?: string;
  videoPath?: string;
  fileName?: string;
  uploadedAt?: string | null;
}

export interface ImageItem {
  url: string;
  path: string;
  caption?: string;
  order: number;
  originalName?: string;
  converted?: boolean;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string; // ISO string
  byUid: string;
  byName: string;
}

export interface Order {
  id: string;
  orderNumber: string; // 4-digit sequential, e.g. "0042"
  clientName: string;
  clientPhone: string;
  value: number;
  videoCount: number;
  videos: VideoItem[];
  images: ImageItem[];
  category: string;
  status: OrderStatus;
  sellerId: string;
  sellerName: string;
  createdAt: Timestamp | null;
  createdAtISO: string;
  folderName: string;
  folderPath: string;
  startedBy?: string;
  startedByUid?: string;
  startedAt?: string | null;
  finishedBy?: string;
  finishedByUid?: string;
  finishedAt?: string | null;
  deliveredAt?: string | null;
  statusHistory: StatusHistoryEntry[];
  sellerNotifiedReady?: boolean;
}

export interface Category {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp | null;
  isDefault?: boolean;
}

export const DEFAULT_CATEGORIES = [
  'Dentista',
  'Home Care',
  'Corretor de Imóveis',
  'Advogado',
  'Festa Infantil',
  'Espaço de Festa',
  'Clínica de Estética',
  'Academia / Personal',
  'Restaurante / Lanchonete',
  'Loja / Varejo',
  'Outros',
];

export const QUICK_VALUES = [59.9, 89.9, 127.9];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendente',
  production: 'Em produção',
  ready: 'Pronto',
  delivered: 'Entregue',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'var(--status-pending)',
  production: 'var(--status-production)',
  ready: 'var(--status-ready)',
  delivered: 'var(--status-delivered)',
};

export const LEVEL_LABELS: Record<UserLevel, string> = {
  seller: 'Vendedor',
  creator: 'Criador de Vídeos',
  manager: 'Gestor Geral',
};
