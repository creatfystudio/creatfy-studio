const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1560351712122900571/Tdbb_o1ectMLUT_G_cOs0NATzTx6HCi_vp-8wZSb7Pt6QiZrLd5c7FicbJJ5Kv2D278a'; 
const TELEGRAM_BOT_TOKEN = '8827925242:AAFnGCL8YglMl_DSU4ksMegH-d7aMUFcjR4';
const TELEGRAM_CHAT_ID = '803132170';

export async function sendTeamNotification(title: string, message: string) {
  const fullText = `🔔 *${title}*\n\n${message}`;

  // 1. Envia para o Discord
  if (DISCORD_WEBHOOK_URL) {
    fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**${title}**\n${message}`,
      }),
    }).catch(() => {});
  }

  // 2. Envia para o Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: fullText,
        parse_mode: 'Markdown',
      }),
    }).catch(() => {});
  }
}