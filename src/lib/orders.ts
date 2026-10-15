import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ImageItem, Order, OrderStatus, StatusHistoryEntry, VideoItem } from '../types';
import {
  buildFolderName,
  buildFolderPath,
  deleteFileAtPath,
  deleteFolderRecursive,
  generateOrderNumber,
  LEADS_ROOT,
  uploadOrderImage,
  uploadOrderReceipt,
  uploadOrderSummaryTxt,
  uploadOrderVideo,
} from './storage';
import type { PendingImage } from '../components/ImageUploader';
import { digitsOnly, formatCurrency, formatDate } from './utils';
import { sendOrderNotification } from './notifications';

function ordersCol() {
  return collection(db, 'orders');
}

export interface NewOrderInput {
  clientName: string;
  clientPhone: string;
  value: number;
  videoCount: number;
  scripts: string[];
  images: PendingImage[];
  receiptFile: File;
  recipientAccount: string;
  category: string;
  sellerId: string;
  sellerName: string;
}

export async function createOrder(
  input: NewOrderInput,
  onImageProgress?: (done: number, total: number) => void
): Promise<string> {
  const now = new Date();
  const orderNumber = await generateOrderNumber();
  const folderName = buildFolderName(orderNumber, input.clientName, input.clientPhone, now);
  const folderPath = buildFolderPath(folderName);

  const uploadedPaths: string[] = [];
  const images: ImageItem[] = [];
  let receiptUrl = '';
  let receiptFileName = '';

  const totalSteps = input.images.length + 1 + 1;
  let completedSteps = 0;

  try {
    const txtLines = [
      `========================================`,
      `        MASCOTFY STUDIO - PEDIDO #${orderNumber}`,
      `========================================`,
      `Data: ${now.toLocaleString('pt-BR')}`,
      `Vendedor: ${input.sellerName}`,
      `----------------------------------------`,
      `Nome do Cliente: ${input.clientName.trim()}`,
      `Número (WhatsApp): ${input.clientPhone}`,
      `Categoria: ${input.category}`,
      `Valor da Venda: ${formatCurrency(input.value)}`,
      `Quantidade de Vídeos: ${input.videoCount}`,
      `----------------------------------------`,
      `[AUDITORIA FINANCEIRA - CAIXA OFICIAL]`,
      `Destinatário/Status do Pagamento: ${input.recipientAccount.trim()}`,
      `========================================`,
      `                ROTEIROS`,
      `========================================`,
      ...input.scripts.map(
        (script, idx) => `\n[VÍDEO ${idx + 1}]\n${script?.trim() || '(Sem roteiro especificado)'}`
      ),
      `\n========================================`,
    ].join('\n');

    await uploadOrderSummaryTxt(folderName, txtLines);
    completedSteps++;
    onImageProgress?.(completedSteps, totalSteps);

    for (let i = 0; i < input.images.length; i++) {
      const img = input.images[i];
      const blob = img.convertedBlob || img.originalFile;
      const fileName = img.convertedFileName || img.originalFile.name;
      const result = await uploadOrderImage(folderName, blob, fileName);
      uploadedPaths.push(result.path);
      images.push({
        url: result.url || '',
        path: result.path || '',
        caption: img.caption || '',
        order: i,
        originalName: img.originalFile?.name || fileName,
        converted: !!img.convertedBlob,
      });
      completedSteps++;
      onImageProgress?.(completedSteps, totalSteps);
    }

    if (input.receiptFile) {
      const receiptRes = await uploadOrderReceipt(folderName, input.receiptFile);
      receiptUrl = receiptRes.url;
      receiptFileName = input.receiptFile.name;
      completedSteps++;
      onImageProgress?.(completedSteps, totalSteps);
    }
  } catch (err) {
    await Promise.all(uploadedPaths.map((p) => deleteFileAtPath(p)));
    throw new Error('Não foi possível enviar os arquivos para o Google Drive. Verifique sua conexão e tente novamente.');
  }

  const videos: VideoItem[] = input.scripts.map((script, idx) => ({
    index: idx + 1,
    script: script || '',
  }));

  const initialHistory: StatusHistoryEntry = {
    status: 'pending',
    at: now.toISOString(),
    byUid: input.sellerId,
    byName: input.sellerName,
  };

  const orderRef = doc(ordersCol());
  const orderData: Record<string, any> = {
    orderNumber,
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone || '',
    value: input.value || 0,
    videoCount: input.videoCount || 1,
    videos,
    images,
    receiptUrl,
    receiptFileName,
    recipientAccount: input.recipientAccount.trim(),
    category: input.category || '',
    status: 'pending',
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    createdAt: serverTimestamp(),
    createdAtISO: now.toISOString(),
    folderName,
    folderPath,
    statusHistory: [initialHistory],
  };

  await setDoc(orderRef, orderData);

  // Notificação de Novo Pedido formatada
  await sendOrderNotification({
    title: `Novo Pedido Registado! (#${orderNumber}) 🚀`,
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone,
    value: formatCurrency(input.value),
    videoCount: input.videoCount,
    cargo: `Vendedor (${input.sellerName})`,
    saleDate: formatDate(now),
  });

  return orderRef.id;
}

function historyEntry(status: OrderStatus, byUid: string, byName: string): StatusHistoryEntry {
  return { status, at: new Date().toISOString(), byUid, byName };
}

export async function startProduction(order: Order, byUid: string, byName: string): Promise<void> {
  const nowISO = new Date().toISOString();
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'production' as OrderStatus,
    startedBy: byName,
    startedByUid: byUid,
    startedAt: nowISO,
    statusHistory: [...order.statusHistory, historyEntry('production', byUid, byName)],
  });
}

export async function requestOrderRevision(
  order: Order,
  revisionNote: string,
  byUid: string,
  byName: string
): Promise<void> {
  const nowISO = new Date().toISOString();
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'production' as OrderStatus,
    revisionRequested: true,
    revisionNote: revisionNote.trim(),
    revisionRequestedAt: nowISO,
    revisionRequestedBy: byName,
    statusHistory: [...order.statusHistory, historyEntry('production', byUid, byName)],
  });
}

export async function uploadVideoForOrder(
  order: Order,
  videoIndex: number,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  const targetFolder = order.folderName || order.folderPath || `#${order.orderNumber} - ${order.clientName}`;
  const result = await uploadOrderVideo(targetFolder, videoIndex, file, onProgress);

  const nextVideos = order.videos.map((v) =>
    v.index === videoIndex
      ? {
          ...v,
          videoUrl: result.url || '',
          videoPath: result.path || '',
          fileName: file.name || `video-${videoIndex}.mp4`,
          uploadedAt: new Date().toISOString(),
        }
      : v
  );

  await updateDoc(doc(db, 'orders', order.id), {
    videos: nextVideos,
    ...(order.status === 'pending' ? { status: 'production' as OrderStatus } : {}),
  });
}

export async function finalizeOrder(order: Order, byUid: string, byName: string): Promise<void> {
  const allUploaded = order.videos.every((v) => !!v.videoUrl);
  if (!allUploaded) throw new Error('Envie todos os vídeos antes de finalizar o pedido.');
  const nowISO = new Date().toISOString();
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'ready' as OrderStatus,
    finishedBy: byName,
    finishedByUid: byUid,
    finishedAt: nowISO,
    statusHistory: [...order.statusHistory, historyEntry('ready', byUid, byName)],
  });

  // Notificação de Vídeo Pronto/Finalizado
  await sendOrderNotification({
    title: `Produção Finalizada! (#${order.orderNumber}) 🎉`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: formatCurrency(order.value),
    videoCount: order.videoCount,
    cargo: `Criador de Vídeos (${byName})`,
    saleDate: formatDate(new Date(order.createdAtISO)),
    deliveryDate: formatDate(new Date()),
  });
}

export async function markDelivered(order: Order, byUid: string, byName: string): Promise<void> {
  const nowISO = new Date().toISOString();
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'delivered' as OrderStatus,
    deliveredAt: nowISO,
    statusHistory: [...order.statusHistory, historyEntry('delivered', byUid, byName)],
  });

  // Notificação de Pedido Entregue ao Cliente
  await sendOrderNotification({
    title: `Pedido Entregue! (#${order.orderNumber}) ✅`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: formatCurrency(order.value),
    videoCount: order.videoCount,
    cargo: `Vendedor / Gestor (${byName})`,
    saleDate: formatDate(new Date(order.createdAtISO)),
    deliveryDate: formatDate(new Date()),
  });
}

export interface EditableOrderFields {
  clientName: string;
  clientPhone: string;
  value: number;
  category: string;
  scripts: string[];
  status: OrderStatus;
}

export async function updateOrder(
  order: Order,
  fields: EditableOrderFields,
  byUid: string,
  byName: string
): Promise<void> {
  const nextVideos = order.videos.map((v, idx) => ({ ...v, script: fields.scripts[idx] ?? v.script }));
  const payload: Record<string, unknown> = {
    clientName: fields.clientName.trim(),
    clientPhone: fields.clientPhone,
    value: fields.value,
    category: fields.category,
    videos: nextVideos,
  };
  if (fields.status !== order.status) {
    payload.status = fields.status;
    payload.statusHistory = [...order.statusHistory, historyEntry(fields.status, byUid, byName)];
  }
  await updateDoc(doc(db, 'orders', order.id), payload);
}

export async function addImagesToOrder(order: Order, newImages: PendingImage[]): Promise<void> {
  const startIndex = order.images.length;
  const added: ImageItem[] = [];
  const targetFolder = order.folderName || order.folderPath || `#${order.orderNumber} - ${order.clientName}`;

  for (let i = 0; i < newImages.length; i++) {
    const img = newImages[i];
    const blob = img.convertedBlob || img.originalFile;
    const fileName = img.convertedFileName || img.originalFile.name;
    const result = await uploadOrderImage(targetFolder, blob, fileName);
    added.push({
      url: result.url || '',
      path: result.path || '',
      caption: img.caption || '',
      order: startIndex + i,
      originalName: img.originalFile?.name || fileName,
      converted: !!img.convertedBlob,
    });
  }
  await updateDoc(doc(db, 'orders', order.id), { images: [...order.images, ...added] });
}

export async function removeImageFromOrder(order: Order, image: ImageItem): Promise<void> {
  await deleteFileAtPath(image.path);
  await updateDoc(doc(db, 'orders', order.id), {
    images: order.images.filter((i) => i.path !== image.path),
  });
}

export async function deleteOrder(order: Order): Promise<void> {
  await deleteFolderRecursive(order.folderPath);
  await deleteDoc(doc(db, 'orders', order.id));
}

export async function bulkDeleteOrders(orders: Order[]): Promise<void> {
  for (const order of orders) {
    await deleteOrder(order);
  }
}

export async function clearAllData(orders: Order[]): Promise<void> {
  await bulkDeleteOrders(orders);
  await deleteFolderRecursive(LEADS_ROOT).catch(() => undefined);
  await setDoc(doc(db, 'system', 'counters'), { orderSeq: 0 }, { merge: true });
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = digitsOnly(phone);
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

export function buildDeliveryMessage(clientName: string, videoUrl: string): string {
  return `Olá, ${clientName}! Tudo bem? 😊\n\nSeu vídeo do mascote está pronto! Aqui está o link para assistir e baixar:\n${videoUrl}\n\nQualquer dúvida, estamos à disposição. Obrigado pela confiança! — Mascotfy Studio`;
}

export async function getOrderOnce(orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
}