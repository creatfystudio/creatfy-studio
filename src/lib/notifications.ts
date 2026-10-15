const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1560351712122900571/Tdbb_o1ectMLUT_G_cOs0NATzTx6HCi_vp-8wZSb7Pt6QiZrLd5c7FicbJJ5Kv2D278a'; 
const TELEGRAM_BOT_TOKEN = '8827925242:AAFnGCL8YglMl_DSU4ksMegH-d7aMUFcjR4';
const TELEGRAM_CHAT_ID = '803132170';

export interface OrderNotificationData {
  title: string;
  clientName: string;
  clientPhone: string;
  value: string;
  videoCount: number;
  cargo: string;
  saleDate: string;
  deliveryDate?: string;
  isDetailed?: boolean; // Define se a notificação é completa (novo pedido) ou resumida
  customMessage?: string; // Para avisos rápidos como início, uploads ou revisões
}

export async function sendOrderNotification(data: OrderNotificationData) {
  let discordMessage = '';
  let telegramMessage = '';

  if (data.isDetailed) {
    // 🚀 NOTIFICAÇÃO COMPLETA (Apenas quando o vendedor cria o pedido pela primeira vez)
    discordMessage = [
      `🚀 **${data.title}**`,
      `👤 **Nome do Cliente:** ${data.clientName}`,
      `📱 **Telefone (WhatsApp):** ${data.clientPhone}`,
      `💰 **Valor da Venda:** ${data.value}`,
      `🎬 **Quantidade de Vídeos:** ${data.videoCount}`,
      `💼 **Cargo / Vendedor:** ${data.cargo}`,
      `📅 **Data de Venda:** ${data.saleDate}`,
      data.deliveryDate ? `📦 **Data de Entrega:** ${data.deliveryDate}` : '',
    ].filter(Boolean).join('\n');

    telegramMessage = [
      `🚀 *${data.title}*`,
      `👤 *Nome do Cliente:* ${data.clientName}`,
      `📱 *Telefone (WhatsApp):* ${data.clientPhone}`,
      `💰 *Valor da Venda:* ${data.value}`,
      `🎬 *Quantidade de Vídeos:* ${data.videoCount}`,
      `💼 *Cargo / Vendedor:* ${data.cargo}`,
      `📅 *Data de Venda:* ${data.saleDate}`,
      data.deliveryDate ? `📦 *Data de Entrega:* ${data.deliveryDate}` : '',
    ].filter(Boolean).join('\n');
  } else {
    // ✨ NOTIFICAÇÕES ORGANIZADAS E RÁPIDAS COM EMOJIS PARA OS OUTROS PROCESSOS
    const emojiTitle = data.title;
    const detail = data.customMessage ? `\n💬 *Obs:* ${data.customMessage}` : '';

    discordMessage = [
      `${emojiTitle}`,
      `• 📋 **Cliente:** ${data.clientName}`,
      `• 🎬 **Pedido:** #${data.clientPhone || 'Geral'}`,
      detail,
    ].filter(Boolean).join('\n');

    telegramMessage = [
      `${emojiTitle}`,
      `• 📋 *Cliente:* ${data.clientName}`,
      `• 🎬 *Detalhe:* Pedido de ${data.clientName}`,
      detail,
    ].filter(Boolean).join('\n');
  }

  // 1. Envia para o Discord
  if (DISCORD_WEBHOOK_URL) {
    fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: discordMessage }),
    }).catch(() => {});
  }

  // 2. Envia para o Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: 'Markdown',
      }),
    }).catch(() => {});
  }
}