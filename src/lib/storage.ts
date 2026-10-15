import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { formatDateHyphen, sanitizeForPath } from './utils';
import { isDriveConnected, getOrCreateFolder, uploadToDrive } from './googleDrive';

export const LEADS_ROOT = 'Dados dos Leads';

export async function generateOrderNumber(): Promise<string> {
  const counterRef = doc(db, 'system', 'counters');
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().orderSeq as number) || 0 : 0;
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

/** Envia a imagem do mascote para a pasta "Dados de Criação" */
export async function uploadOrderImage(
  folderName: string,
  file: Blob,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (isDriveConnected()) {
    const rootFolderId = await getOrCreateFolder(LEADS_ROOT);
    const orderFolderId = await getOrCreateFolder(folderName, rootFolderId);
    const creationFolderId = await getOrCreateFolder('Dados de Criação', orderFolderId);
    const res = await uploadToDrive(file, `Mascote_${Date.now()}_${fileName}`, creationFolderId);
    onProgress?.(100);
    return { url: res.url, path: res.fileId };
  }
  throw new Error('Google Drive não está conectado. Acesse a aba Usuários e clique em Conectar Google Drive.');
}

/** Cria e envia o arquivo .txt com todos os dados e roteiros para "Dados de Criação" */
export async function uploadOrderSummaryTxt(
  folderName: string,
  textContent: string
): Promise<UploadResult> {
  if (isDriveConnected()) {
    const rootFolderId = await getOrCreateFolder(LEADS_ROOT);
    const orderFolderId = await getOrCreateFolder(folderName, rootFolderId);
    const creationFolderId = await getOrCreateFolder('Dados de Criação', orderFolderId);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const res = await uploadToDrive(blob, 'Dados_do_Pedido.txt', creationFolderId);
    return { url: res.url, path: res.fileId };
  }
  throw new Error('Google Drive não está conectado.');
}

/** Envia o comprovante da venda para "Dados de Criação" */
export async function uploadOrderReceipt(
  folderName: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (isDriveConnected()) {
    const rootFolderId = await getOrCreateFolder(LEADS_ROOT);
    const orderFolderId = await getOrCreateFolder(folderName, rootFolderId);
    const creationFolderId = await getOrCreateFolder('Dados de Criação', orderFolderId);
    const res = await uploadToDrive(file, `Comprovante_${Date.now()}_${file.name}`, creationFolderId);
    onProgress?.(100);
    return { url: res.url, path: res.fileId };
  }
  throw new Error('Google Drive não está conectado.');
}

/** Envia os vídeos produzidos para a pasta "Vídeos" */
export async function uploadOrderVideo(
  folderName: string,
  videoIndex: number,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (isDriveConnected()) {
    const rootFolderId = await getOrCreateFolder(LEADS_ROOT);
    const orderFolderId = await getOrCreateFolder(folderName, rootFolderId);
    const videosFolderId = await getOrCreateFolder('Vídeos', orderFolderId);
    const res = await uploadToDrive(file, `Video_${videoIndex}_${Date.now()}_${file.name}`, videosFolderId);
    onProgress?.(100);
    return { url: res.url, path: res.fileId };
  }
  throw new Error('Google Drive não está conectado. Acesse a aba Usuários e clique em Conectar Google Drive.');
}

export async function deleteFileAtPath(_path: string): Promise<void> {
  // Mantém os arquivos seguros no Drive
}

export async function deleteFolderRecursive(_folderPath: string): Promise<void> {
  // Mantém a pasta no Drive por segurança
}

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