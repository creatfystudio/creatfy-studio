import {
  arrayUnion,
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

function getTargetFolder(order: Order): string {
  return order.folderName || order.folderPath || `#${order.orderNumber} - ${order.clientName}`;
}

/** Lê o pedido atual do Firestore para não sobrescrever alterações feitas por outra pessoa. */
async function getCurrentOrder(order: Order): Promise<Order> {
  const current = await getOrderOnce(order.id);
  if (!current) throw new Error('Pedido não encontrado. Ele pode ter sido excluído.');
  return current;
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

  const images: ImageItem[] = [];
  let receiptUrl = '';
  let receiptFileName = '';

  const totalSteps = input.images.length + 2; // resumo + imagens + comprovante
  let completedSteps = 0;

  // Remove a pasta inteira caso algo falhe, para não deixar arquivos órfãos no Drive.
  const cleanupFolder = () =>
    deleteFolderRecursive(folderPath).catch((e) => console.warn('[orders] falha ao limpar pasta', e));

  try {
    const txtLines = [
      `========================================`,
      `        CREATFY STUDIO - PEDIDO #${orderNumber}`,
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

    const receiptRes = await uploadOrderReceipt(folderName, input.receiptFile);
    receiptUrl = receiptRes.url;
    receiptFileName = input.receiptFile.name;
    completedSteps++;
    onImageProgress?.(completedSteps, totalSteps);
  } catch (err) {
    await cleanupFolder();
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
  const orderData: Record<string, unknown> = {
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

  try {
    await setDoc(orderRef, orderData);
  } catch (err) {
    await cleanupFolder();
    throw new Error('Não foi possível salvar o pedido. Tente novamente.');
  }

  // Não aguarda: falha de notificação não deve travar o cadastro.
  void sendOrderNotification({
    title: `Novo Pedido Registado! (#${orderNumber})`,
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone,
    value: formatCurrency(input.value),
    videoCount: input.videoCount,
    cargo: 'Vendedor',
    sellerName: input.sellerName,
    saleDate: formatDate(now),
    isDetailed: true,
  });

  return orderRef.id;
}

function historyEntry(status: OrderStatus, byUid: string, byName: string): StatusHistoryEntry {
  return { status, at: new Date().toISOString(), byUid, byName };
}

export async function startProduction(order: Order, byUid: string, byName: string): Promise<void> {
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'production' as OrderStatus,
    startedBy: byName,
    startedByUid: byUid,
    startedAt: new Date().toISOString(),
    statusHistory: arrayUnion(historyEntry('production', byUid, byName)),
  });

  void sendOrderNotification({
    title: `🎬 Produção 3D Iniciada! (#${order.orderNumber})`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: '',
    videoCount: order.videoCount,
    cargo: 'Criador',
    sellerName: order.sellerName,
    saleDate: '',
    isDetailed: false,
    customMessage: `Iniciado por ${byName}.`,
  });
}

export async function requestOrderRevision(
  order: Order,
  revisionNote: string,
  byUid: string,
  byName: string
): Promise<void> {
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'production' as OrderStatus,
    revisionRequested: true,
    revisionNote: revisionNote.trim(),
    revisionRequestedAt: new Date().toISOString(),
    revisionRequestedBy: byName,
    statusHistory: arrayUnion(historyEntry('production', byUid, byName)),
  });

  void sendOrderNotification({
    title: `🔄 Alteração Solicitada! (#${order.orderNumber})`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: '',
    videoCount: order.videoCount,
    cargo: 'Vendedor',
    sellerName: order.sellerName,
    saleDate: '',
    isDetailed: false,
    customMessage: revisionNote.trim(),
  });
}

export async function uploadVideoForOrder(
  order: Order,
  videoIndex: number,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  const current = await getCurrentOrder(order);
  const result = await uploadOrderVideo(getTargetFolder(current), videoIndex, file, onProgress);

  try {
    const nextVideos = current.videos.map((v) =>
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
      ...(current.status === 'pending' ? { status: 'production' as OrderStatus } : {}),
    });
  } catch (err) {
    // Sem registro no pedido, o vídeo ficaria órfão no Drive.
    if (result.path) await deleteFileAtPath(result.path).catch(() => undefined);
    throw new Error('Não foi possível registrar o vídeo no pedido. Tente novamente.');
  }
}

export async function finalizeOrder(order: Order, byUid: string, byName: string): Promise<void> {
  const current = await getCurrentOrder(order);
  const allUploaded = current.videos.every((v) => !!v.videoUrl);
  if (!allUploaded) throw new Error('Envie todos os vídeos antes de finalizar o pedido.');

  await updateDoc(doc(db, 'orders', order.id), {
    status: 'ready' as OrderStatus,
    finishedBy: byName,
    finishedByUid: byUid,
    finishedAt: new Date().toISOString(),
    revisionRequested: false,
    statusHistory: arrayUnion(historyEntry('ready', byUid, byName)),
  });

  void sendOrderNotification({
    title: `🎉 Produção Finalizada! (#${order.orderNumber})`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: '',
    videoCount: order.videoCount,
    cargo: 'Criador',
    sellerName: order.sellerName,
    saleDate: '',
    isDetailed: false,
    customMessage: `Finalizado por ${byName}! Pronto para entrega.`,
  });
}

export async function markDelivered(order: Order, byUid: string, byName: string): Promise<void> {
  await updateDoc(doc(db, 'orders', order.id), {
    status: 'delivered' as OrderStatus,
    deliveredAt: new Date().toISOString(),
    statusHistory: arrayUnion(historyEntry('delivered', byUid, byName)),
  });

  void sendOrderNotification({
    title: `✅ Vídeo Entregue! (#${order.orderNumber})`,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    value: '',
    videoCount: order.videoCount,
    cargo: 'Vendedor',
    sellerName: order.sellerName,
    saleDate: '',
    isDetailed: false,
    customMessage: `Entregue com sucesso por ${byName}.`,
  });
}

export interface EditableOrderFields {
  clientName: string;
  clientPhone: string;
  value: number;
  category: string;
  scripts: string[];
  /** Enviado só quando o usuário tem permissão para alterar o status. */
  status?: OrderStatus;
}

export async function updateOrder(
  order: Order,
  fields: EditableOrderFields,
  byUid: string,
  byName: string
): Promise<void> {
  const current = await getCurrentOrder(order);
  const nextVideos = current.videos.map((v, idx) => ({
    ...v,
    script: fields.scripts[idx] ?? v.script,
  }));

  const payload: Record<string, unknown> = {
    clientName: fields.clientName.trim(),
    clientPhone: fields.clientPhone,
    value: fields.value,
    category: fields.category,
    videos: nextVideos,
  };

  if (fields.status !== undefined && fields.status !== current.status) {
    payload.status = fields.status;
    payload.statusHistory = arrayUnion(historyEntry(fields.status, byUid, byName));
  }

  await updateDoc(doc(db, 'orders', order.id), payload);
}

export async function addImagesToOrder(order: Order, newImages: PendingImage[]): Promise<void> {
  const current = await getCurrentOrder(order);
  const startIndex = current.images.length;
  const targetFolder = getTargetFolder(current);
  const added: ImageItem[] = [];

  try {
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

    await updateDoc(doc(db, 'orders', order.id), { images: [...current.images, ...added] });
  } catch (err) {
    await Promise.all(added.map((i) => deleteFileAtPath(i.path).catch(() => undefined)));
    throw new Error('Não foi possível adicionar as imagens. Tente novamente.');
  }
}

export async function removeImageFromOrder(order: Order, image: ImageItem): Promise<void> {
  const current = await getCurrentOrder(order);

  // Atualiza o banco primeiro: se falhar, a imagem continua listada e o arquivo continua existindo.
  await updateDoc(doc(db, 'orders', order.id), {
    images: current.images.filter((i) => i.path !== image.path),
  });

  // Se a remoção do arquivo falhar, sobra só um arquivo órfão, o que não quebra o pedido.
  await deleteFileAtPath(image.path).catch((e) =>
    console.warn('[orders] imagem removida do pedido, mas o arquivo não foi apagado', e)
  );
}

export async function deleteOrder(order: Order): Promise<void> {
  const folderToDelete =
    order.folderPath || (order.folderName ? buildFolderPath(order.folderName) : '');

  if (folderToDelete) {
    await deleteFolderRecursive(folderToDelete);
  }
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
  // Com código do país o número tem 12 ou 13 dígitos (55 + DDD + número).
  const hasCountryCode = (digits.length === 12 || digits.length === 13) && digits.startsWith('55');
  const withCountryCode = hasCountryCode ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

export function buildDeliveryMessage(clientName: string, videoUrl: string): string {
  return `Olá, ${clientName}! Tudo bem? 😊\n\nSeu vídeo está pronto! Aqui está o link para assistir e baixar:\n${videoUrl}\n\nQualquer dúvida, estamos à disposição. Obrigado pela confiança! — Creatfy Studio`;
}

export async function getOrderOnce(orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
}