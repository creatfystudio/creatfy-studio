const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1560778728701698108/mlRXf7mz6ezK5em8UmjI3y8rf8UqXSMYRE6R9HdUSaP628V0CsV-2f-idsRtV7lBCG9o'; 
const TELEGRAM_BOT_TOKEN = '8982728624:AAHHNwdTdT58n-w-VjQK7G51ap73S2-DWG4';
const TELEGRAM_CHAT_ID = '-1003892186022';

export interface OrderNotificationData {
  title: string;
  clientName: string;
  clientPhone: string;
  value: string;
  videoCount: number;
  cargo: string;
  sellerName?: string; // Nome explícito do vendedor
  saleDate: string;
  deliveryDate?: string;
  isDetailed?: boolean;
  customMessage?: string;
}

export async function sendOrderNotification(data: OrderNotificationData) {
  let discordMessage = '';
  let telegramMessage = '';

  const sellerInfo = data.sellerName ? `• 👤 **Vendedor:** ${data.sellerName}\n` : '';
  const sellerInfoTg = data.sellerName ? `• 👤 *Vendedor:* ${data.sellerName}\n` : '';

  if (data.isDetailed) {
    discordMessage = [
      `🚀 **${data.title}**`,
      `👤 **Nome do Cliente:** ${data.clientName}`,
      `📱 **Telefone (WhatsApp):** ${data.clientPhone}`,
      `💰 **Valor da Venda:** ${data.value}`,
      `🎬 **Quantidade de Vídeos:** ${data.videoCount}`,
      `💼 **Cargo / Responsável:** ${data.cargo}`,
      data.sellerName ? `🤝 **Vendedor:** ${data.sellerName}` : '',
      `📅 **Data de Venda:** ${data.saleDate}`,
      data.deliveryDate ? `📦 **Data de Entrega:** ${data.deliveryDate}` : '',
    ].filter(Boolean).join('\n');

    telegramMessage = [
      `🚀 *${data.title}*`,
      `👤 *Nome do Cliente:* ${data.clientName}`,
      `📱 *Telefone (WhatsApp):* ${data.clientPhone}`,
      `💰 *Valor da Venda:* ${data.value}`,
      `🎬 *Quantidade de Vídeos:* ${data.videoCount}`,
      `💼 *Cargo / Responsável:* ${data.cargo}`,
      data.sellerName ? `🤝 *Vendedor:* ${data.sellerName}` : '',
      `📅 *Data de Venda:* ${data.saleDate}`,
      data.deliveryDate ? `📦 *Data de Entrega:* ${data.deliveryDate}` : '',
    ].filter(Boolean).join('\n');
  } else {
    const emojiTitle = data.title;
    const detail = data.customMessage ? `\n💬 *Obs:* ${data.customMessage}` : '';

    discordMessage = [
      `${emojiTitle}`,
      `• 📋 **Cliente:** ${data.clientName}`,
      sellerInfo.replace('• ', '• 🤝 '),
      `• 🎬 **Detalhe:** Pedido #${data.clientPhone || 'Geral'}`,
      detail,
    ].filter(Boolean).join('\n');

    telegramMessage = [
      `${emojiTitle}`,
      `• 📋 *Cliente:* ${data.clientName}`,
      sellerInfoTg.replace('• ', '• 🤝 '),
      `• 🎬 *Detalhe:* Pedido de ${data.clientName}`,
      detail,
    ].filter(Boolean).join('\n');
  }

  if (DISCORD_WEBHOOK_URL) {
    fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: discordMessage }),
    }).catch(() => {});
  }

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