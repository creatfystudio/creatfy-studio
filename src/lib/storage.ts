import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { formatDateHyphen, sanitizeForPath } from './utils';
import { isDriveConnected, getOrCreateFolder, uploadToDrive } from './googleDrive';

export const LEADS_ROOT = 'Dados dos Leads';
const CREATION_FOLDER = 'Dados de Criação';
const VIDEOS_FOLDER = 'Vídeos';
const NOT_CONNECTED_MSG =
  'Google Drive não está conectado. Acesse a aba Usuários e clique em Conectar Google Drive.';

/**
 * Cache de IDs de pasta. Guarda a Promise, não o ID, para que chamadas
 * simultâneas reutilizem a mesma criação e não gerem pastas duplicadas.
 * Deve ser limpo ao desconectar o Drive ou ao trocar de conta.
 */
const folderCache = new Map<string, Promise<string>>();

function cachedFolder(name: string, parentId?: string): Promise<string> {
  const key = `${parentId ?? 'root'}::${name}`;
  let promise = folderCache.get(key);
  if (!promise) {
    promise = getOrCreateFolder(name, parentId);
    // Falhas não ficam no cache, para a próxima tentativa refazer a busca.
    promise.catch(() => folderCache.delete(key));
    folderCache.set(key, promise);
  }
  return promise;
}

/** Chame ao desconectar, trocar a conta do Google Drive ou fazer logout no app. */
export function clearDriveFolderCache(): void {
  folderCache.clear();
}

function assertDriveConnected(): void {
  if (!isDriveConnected()) throw new Error(NOT_CONNECTED_MSG);
}

async function getOrderFolderId(folderName: string): Promise<string> {
  const rootId = await cachedFolder(LEADS_ROOT);
  return cachedFolder(folderName, rootId);
}

async function getCreationFolderId(folderName: string): Promise<string> {
  return cachedFolder(CREATION_FOLDER, await getOrderFolderId(folderName));
}

async function getVideosFolderId(folderName: string): Promise<string> {
  return cachedFolder(VIDEOS_FOLDER, await getOrderFolderId(folderName));
}

export async function generateOrderNumber(): Promise<string> {
  const counterRef = doc(db, 'system', 'counters');
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data().orderSeq) || 0 : 0;
    const updated = current + 1;
    tx.set(counterRef, { orderSeq: updated }, { merge: true });
    return updated;
  });
  return String(next).padStart(4, '0');
}

export function buildFolderName(
  orderNumber: string,
  clientName: string,
  clientPhone: string,
  createdAt: Date
): string {
  return [orderNumber, sanitizeForPath(clientName), clientPhone, formatDateHyphen(createdAt)].join(' | ');
}

export function buildFolderNameNoPhone(orderNumber: string, clientName: string, createdAt: Date): string {
  return [orderNumber, sanitizeForPath(clientName), formatDateHyphen(createdAt)].join(' | ');
}

export function buildFolderPath(folderName: string): string {
  return `${LEADS_ROOT}/${folderName}`;
}

export interface UploadResult {
  url: string;
  path: string;
}

/** Envia imagem de referência do pedido para "Dados de Criação". */
export async function uploadOrderImage(
  folderName: string,
  file: Blob,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  assertDriveConnected();
  const folderId = await getCreationFolderId(folderName);
  const res = await uploadToDrive(file, `Mascote_${Date.now()}_${fileName}`, folderId, onProgress);
  return { url: res.url, path: res.fileId };
}

/** Cria e envia o .txt com os dados e roteiros para "Dados de Criação". */
export async function uploadOrderSummaryTxt(folderName: string, textContent: string): Promise<UploadResult> {
  assertDriveConnected();
  const folderId = await getCreationFolderId(folderName);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const res = await uploadToDrive(blob, 'Dados_do_Pedido.txt', folderId);
  return { url: res.url, path: res.fileId };
}

/** Envia o comprovante para "Dados de Criação". */
export async function uploadOrderReceipt(
  folderName: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  assertDriveConnected();
  const folderId = await getCreationFolderId(folderName);
  const res = await uploadToDrive(file, `Comprovante_${Date.now()}_${file.name}`, folderId, onProgress);
  return { url: res.url, path: res.fileId };
}

/** Envia o vídeo produzido para "Vídeos". */
export async function uploadOrderVideo(
  folderName: string,
  videoIndex: number,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  assertDriveConnected();
  const folderId = await getVideosFolderId(folderName);
  const res = await uploadToDrive(file, `Video_${videoIndex}_${Date.now()}_${file.name}`, folderId, onProgress);
  return { url: res.url, path: res.fileId };
}

// Intencionalmente sem efeito: os arquivos ficam no Drive por segurança.
export async function deleteFileAtPath(_path: string): Promise<void> {}

// Intencionalmente sem efeito: as pastas ficam no Drive por segurança.
export async function deleteFolderRecursive(_folderPath: string): Promise<void> {}

export function triggerBrowserDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}