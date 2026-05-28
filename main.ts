// main.ts
// A simple Deno server that serves "online" and polls Destiny's Kick stream status every 15 minutes.
// It uses Telegram's pinned chat message to persist state (checking if already notified for the current stream).

interface TelegramMessage {
  message_id: number;
  text?: string;
  date: number;
}

interface ChatResponse {
  ok: boolean;
  result?: {
    pinned_message?: TelegramMessage;
  };
  description?: string;
}

function getFallbackChatID(chatID: string): string | null {
  if (chatID.startsWith("-100")) {
    return `-${chatID.slice(4)}`;
  } else if (chatID.startsWith("-")) {
    return `-100${chatID.slice(1)}`;
  } else {
    return `-100${chatID}`;
  }
}

async function getPinnedMessage(botToken: string, chatID: string): Promise<TelegramMessage | null> {
  const tryGet = async (id: string): Promise<{ success: boolean; pinnedMessage?: TelegramMessage | null }> => {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id }),
      });
      const data: ChatResponse = await resp.json();
      if (!resp.ok) {
        console.error(`Failed to get chat info for ${id}:`, data);
        return { success: false };
      }
      return { success: true, pinnedMessage: data.result?.pinned_message || null };
    } catch (err) {
      console.error(`Network error getting chat info for ${id}:`, err);
      return { success: false };
    }
  };

  const res = await tryGet(chatID);
  if (res.success) return res.pinnedMessage ?? null;

  const fallbackID = getFallbackChatID(chatID);
  if (fallbackID) {
    console.log(`Retrying getPinnedMessage with fallback chat ID: ${fallbackID}`);
    const resFallback = await tryGet(fallbackID);
    if (resFallback.success) return resFallback.pinnedMessage ?? null;
  }
  return null;
}

async function sendTelegramMessage(botToken: string, chatID: string, text: string): Promise<number | null> {
  const trySend = async (id: string): Promise<number | null> => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text,
          parse_mode: "HTML",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error(`Failed to send telegram message to ${id}:`, data);
        return null;
      }
      const messageId = data.result?.message_id;
      console.log(`Successfully sent telegram message to ${id}, message ID: ${messageId}`);
      return messageId;
    } catch (err) {
      console.error(`Network error sending telegram message to ${id}:`, err);
      return null;
    }
  };

  const messageId = await trySend(chatID);
  if (messageId !== null) return messageId;

  const fallbackID = getFallbackChatID(chatID);
  if (fallbackID) {
    console.log(`Retrying sendMessage with fallback Chat ID: ${fallbackID}`);
    return await trySend(fallbackID);
  }
  return null;
}

async function pinMessage(botToken: string, chatID: string, messageID: number): Promise<boolean> {
  const tryPin = async (id: string) => {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/pinChatMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, message_id: messageID, disable_notification: true }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error(`Failed to pin message ${messageID} in ${id}:`, data);
        return false;
      }
      console.log(`Successfully pinned message ${messageID} in ${id}`);
      return true;
    } catch (err) {
      console.error(`Error pinning message in ${id}:`, err);
      return false;
    }
  };

  const success = await tryPin(chatID);
  if (success) return true;

  const fallbackID = getFallbackChatID(chatID);
  if (fallbackID) {
    console.log(`Retrying pinMessage with fallback chat ID: ${fallbackID}`);
    return await tryPin(fallbackID);
  }
  return false;
}

async function unpinMessage(botToken: string, chatID: string): Promise<boolean> {
  const tryUnpin = async (id: string) => {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/unpinChatMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.warn(`Unpin API returned warning/error for ${id}:`, data);
        return false;
      }
      console.log(`Successfully unpinned messages in ${id}`);
      return true;
    } catch (err) {
      console.error(`Error unpinning message in ${id}:`, err);
      return false;
    }
  };

  const success = await tryUnpin(chatID);
  if (success) return true;

  const fallbackID = getFallbackChatID(chatID);
  if (fallbackID) {
    console.log(`Retrying unpinMessage with fallback chat ID: ${fallbackID}`);
    return await tryUnpin(fallbackID);
  }
  return false;
}

async function checkStreamAndNotify(botToken: string, chatID: string, force = false): Promise<string> {
  console.log("Checking Destiny stream status on Kick...");

  let channelData;
  try {
    const res = await fetch("https://kick.com/api/v2/channels/destiny");
    if (!res.ok) {
      const text = await res.text();
      console.error(`Kick API returned error status ${res.status}:`, text);
      return `Error fetching Kick API: HTTP ${res.status}`;
    }
    channelData = await res.json();
  } catch (err) {
    console.error("Failed to fetch Destiny channel from Kick:", err);
    return `Error fetching Kick API: Network error`;
  }

  const livestream = channelData.livestream;
  const isCurrentlyLive = livestream !== null && livestream !== undefined && livestream.is_live === true;

  if (isCurrentlyLive) {
    const currentStreamId = livestream.id;
    console.log(`Destiny is LIVE! Stream ID: ${currentStreamId}, Title: "${livestream.session_title}"`);

    // Retrieve the pinned message from Telegram to check state
    const pinned = await getPinnedMessage(botToken, chatID);
    let alreadyNotified = false;

    if (pinned && pinned.text) {
      const match = pinned.text.match(/\[StreamID:\s*(\d+)\]/);
      if (match && match[1] === String(currentStreamId)) {
        alreadyNotified = true;
      }
    }

    if (alreadyNotified && !force) {
      console.log(`Already notified channel for stream ID ${currentStreamId}. Skipping.`);
      return `Live (Already notified: ID ${currentStreamId})`;
    }

    // Build stream alert message
    const categoryName = livestream.categories?.[0]?.name || "Just Chatting";
    const messageText = `🔴 <b>Destiny is LIVE on Kick!</b>\n\n` +
      `<b>Title:</b> ${livestream.session_title}\n` +
      `<b>Category:</b> ${categoryName}\n` +
      `<b>Viewers:</b> ${livestream.viewer_count}\n\n` +
      `Watch here: https://kick.com/destiny\n\n` +
      `<tg-spoiler>[StreamID: ${currentStreamId}]</tg-spoiler>`;

    console.log("Sending live notification to Telegram...");
    const messageId = await sendTelegramMessage(botToken, chatID, messageText);

    if (messageId !== null) {
      console.log(`Pinning live notification message ID ${messageId}...`);
      const pinnedSuccess = await pinMessage(botToken, chatID, messageId);
      if (!pinnedSuccess) {
        console.warn("Could not pin the message. Make sure the bot has 'Pin Messages' permission in the channel.");
      }
      return `Live (Notification sent & pinned: ID ${currentStreamId})`;
    } else {
      return `Live (Failed to send notification)`;
    }
  } else {
    console.log("Destiny is offline.");

    // Check if we have an active stream notification pinned and unpin it to clean up
    const pinned = await getPinnedMessage(botToken, chatID);
    if (pinned && pinned.text && pinned.text.includes("[StreamID:")) {
      console.log("Found previous live notification pinned. Stream is now offline, unpinning...");
      await unpinMessage(botToken, chatID);
      return "Offline (Unpinned previous live notification)";
    }

    return "Offline (No action needed)";
  }
}

// Handler for incoming HTTP requests
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Homepage route
  if (url.pathname === "/") {
    return new Response("online", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Trigger route for manual testing/checking
  if (url.pathname === "/trigger") {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatID) {
      return new Response("Error: Missing env variables TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID", {
        status: 500,
      });
    }

    const force = url.searchParams.has("force");
    const result = await checkStreamAndNotify(botToken, chatID, force);
    return new Response(`Check complete: ${result}`, { status: 200 });
  }

  return new Response("Not Found", { status: 404 });
}

// Start HTTP Server
const port = 8000;
Deno.serve({ port }, handleRequest);
console.log(`Server running at http://localhost:${port}`);

// Register Deno Cron Job (runs every 15 minutes)
Deno.cron("Kick Stream Check Cron", "*/15 * * * *", async () => {
  console.log("Cron triggered: Checking Destiny stream status...");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatID) {
    console.error("Cron failed: Missing env variables TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  await checkStreamAndNotify(botToken, chatID);
});
