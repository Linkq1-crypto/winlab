/**
 * Telegram Bot Integration
 * Handles approval workflow with inline buttons
 * Supports: approve/reject, market info, preview links
 */

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      callback_data: string;
    }>>;
  };
}

interface TelegramCallback {
  id: string;
  data: string;
  message?: {
    chat: { id: string };
    message_id: number;
  };
}

/**
 * Send approval message to Telegram with inline buttons
 */
export async function sendApprovalRequest(
  botToken: string,
  chatId: string,
  jobData: {
    jobId: string;
    hook: string;
    market: string;
    score: number;
    previewUrl: string;
    duration: number;
    platforms: string[];
  }
): Promise<void> {
  const message = `🎬 *New Video Ready*

📝 Hook: ${jobData.hook}
🌍 Market: ${jobData.market.toUpperCase()}
📊 Score: ${(jobData.score * 100).toFixed(0)}%
⏱️ Duration: ${jobData.duration}s
📱 Platforms: ${jobData.platforms.join(", ")}

🔗 Preview: ${jobData.previewUrl}

_Approve or reject below_`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `approve:${jobData.jobId}` },
        { text: "❌ Reject", callback_data: `reject:${jobData.jobId}` }
      ],
      [
        { text: "🇺🇸 US", callback_data: `market:us:${jobData.jobId}` },
        { text: "🇮🇳 IN", callback_data: `market:in:${jobData.jobId}` },
        { text: "🌍 AF", callback_data: `market:af:${jobData.jobId}` }
      ],
      [
        { text: "📊 Full Report", callback_data: `report:${jobData.jobId}` }
      ]
    ]
  };

  const payload: TelegramMessage = {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown",
    reply_markup: keyboard
  };

  await sendTelegramMessage(botToken, payload);
}

/**
 * Send notification message to Telegram
 */
export async function sendNotification(
  botToken: string,
  chatId: string,
  title: string,
  description: string,
  emoji: string = "📢"
): Promise<void> {
  const message = `${emoji} *${title}*\n\n${description}`;

  await sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  });
}

/**
 * Handle callback query from inline buttons
 */
export async function handleCallback(
  callback: TelegramCallback,
  botToken: string,
  chatId: string
): Promise<{ action: string; jobId?: string; market?: string }> {
  const [action, ...params] = callback.data.split(":");
  const jobId = params[0];
  const market = params[1];

  // Answer callback to remove loading state
  await answerCallback(botToken, callback.id);

  // Process action
  switch (action) {
    case "approve":
      await editMessage(botToken, chatId, callback.message!.message_id, "✅ Video approved and publishing...");
      return { action: "approve", jobId };

    case "reject":
      await editMessage(botToken, chatId, callback.message!.message_id, "❌ Video rejected");
      return { action: "reject", jobId };

    case "market":
      await sendNotification(botToken, chatId, "Market Changed", `Switching to ${market?.toUpperCase()} preset`, "🌍");
      return { action: "market", jobId, market };

    case "report":
      await sendNotification(botToken, chatId, "Report Requested", `Full report for job ${jobId}`, "📊");
      return { action: "report", jobId };

    default:
      return { action: "unknown" };
  }
}

/**
 * Send message published confirmation
 */
export async function sendPublishedConfirmation(
  botToken: string,
  chatId: string,
  jobData: {
    jobId: string;
    hook: string;
    market: string;
    platforms: Record<string, { status: string; id?: string }>;
  }
): Promise<void> {
  const platformStatus = Object.entries(jobData.platforms)
    .map(([platform, result]) => `${result.status === "success" ? "✅" : "❌"} ${platform}`)
    .join("\n");

  const message = `🚀 *Video Published*

📝 Hook: ${jobData.hook}
🌍 Market: ${jobData.market.toUpperCase()}
🆔 Job: ${jobData.jobId}

*Platform Status:*
${platformStatus}`;

  await sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  });
}

/**
 * Send error notification
 */
export async function sendErrorNotification(
  botToken: string,
  chatId: string,
  error: string,
  jobId?: string
): Promise<void> {
  const message = `💥 *Pipeline Error*

${error}
${jobId ? `\nJob: ${jobId}` : ""}`;

  await sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  });
}

/**
 * Internal: Send Telegram message
 */
async function sendTelegramMessage(botToken: string, payload: TelegramMessage): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ Telegram send failed:", error);
  }
}

/**
 * Internal: Answer callback query
 */
async function answerCallback(botToken: string, callbackId: string): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId })
    }
  );
}

/**
 * Internal: Edit message text
 */
async function editMessage(
  botToken: string,
  chatId: string,
  messageId: number,
  newText: string
): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${botToken}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText
      })
    }
  );
}

/**
 * Get chat ID from bot username
 * Call once to get your chat ID
 */
export async function getChatId(botToken: string): Promise<string | null> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates`
  );

  if (!response.ok) return null;

  const data = await response.json();
  if (data.result && data.result.length > 0) {
    return data.result[0].message?.chat.id?.toString() || null;
  }

  return null;
}

/**
 * Send CTR alert with cooldown (1x/day per market)
 */
export async function sendCTRAlert(
  botToken: string,
  chatId: string,
  market: string,
  ctr: number,
  threshold: number,
  jobId?: string
): Promise<void> {
  const emoji = ctr < 1.5 ? "🚨" : "⚠️";
  const level = ctr < 1.5 ? "CRITICAL" : "LOW";
  
  const message = `${emoji} *CTR Alert - ${market.toUpperCase()}*

CTR: ${ctr.toFixed(1)}% (threshold: ${threshold}%)
Level: ${level}
${jobId ? `Job: ${jobId}` : ""}

_Check dashboard for details_`;

  await sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  });
}

/**
 * Send sync failure alert
 */
export async function sendSyncFailAlert(
  botToken: string,
  chatId: string,
  market: string,
  error: string
): Promise<void> {
  const message = `🚨 *Sync Failed - ${market.toUpperCase()}*

Error: ${error}
Time: ${new Date().toISOString()}

_Retry will occur tomorrow_`;

  await sendTelegramMessage(botToken, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  });
}

/**
 * Unified Multi-Channel Notification
 * Sends to Telegram + Discord/Slack simultaneously
 * Fire-and-forget: failures don't block the worker
 */
export async function notifyAdminChannels(
  env: {
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    DISCORD_WEBHOOK_URL?: string;
    SLACK_WEBHOOK_URL?: string;
  },
  payload: {
    title: string;
    message: string;
    level: "info" | "warning" | "critical";
    market?: string;
    jobId?: string;
  }
): Promise<void> {
  const emoji = payload.level === "critical" ? "🚨" : payload.level === "warning" ? "⚠️" : "📢";
  const color = payload.level === "critical" ? 0xef4444 : payload.level === "warning" ? 0xf59e0b : 0x3b82f6;

  // Telegram (existing)
  const tgMessage = `${emoji} *${payload.title}*

${payload.message}
${payload.market ? `Market: ${payload.market.toUpperCase()}` : ""}
${payload.jobId ? `Job: ${payload.jobId}` : ""}`;

  sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
    text: tgMessage,
    parse_mode: "Markdown"
  }).catch(err => console.error("Telegram notification failed:", err));

  // Discord Webhook (fire-and-forget)
  if (env.DISCORD_WEBHOOK_URL) {
    fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `${emoji} ${payload.title}`,
          description: payload.message,
          color,
          fields: [
            payload.market ? { name: "Market", value: payload.market.toUpperCase(), inline: true } : null,
            payload.jobId ? { name: "Job ID", value: payload.jobId, inline: true } : null
          ].filter(Boolean),
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(err => console.error("Discord notification failed:", err));
  }

  // Slack Webhook (fire-and-forget)
  if (env.SLACK_WEBHOOK_URL) {
    fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          { type: "header", text: { type: "plain_text", text: `${emoji} ${payload.title}` } },
          { type: "section", text: { type: "mrkdwn", text: payload.message } },
          {
            type: "context",
            elements: [
              payload.market ? { type: "mrkdwn", text: `*Market:* ${payload.market.toUpperCase()}` } : null,
              payload.jobId ? { type: "mrkdwn", text: `*Job:* ${payload.jobId}` } : null
            ].filter(Boolean)
          }
        ]
      })
    }).catch(err => console.error("Slack notification failed:", err));
  }
}
