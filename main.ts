// main.ts
// A simple Deno server that serves "online" and pings a Telegram channel every 5 minutes.

async function sendTelegramMessage(botToken: string, chatID: string, text: string): Promise<boolean> {
  const trySend = async (id: string) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error(`Failed to send telegram message to ${id}:`, data);
        return false;
      }
      console.log(`Successfully sent telegram message to ${id}:`, data.result?.message_id);
      return true;
    } catch (err) {
      console.error(`Network error sending telegram message to ${id}:`, err);
      return false;
    }
  };

  // Try configured ID first
  console.log(`Attempting to send Telegram message to chat ID: ${chatID}`);
  const success = await trySend(chatID);
  if (success) return true;

  // Fallback / retry logic if it starts with or without -100
  let fallbackID: string | null = null;
  if (chatID.startsWith("-100")) {
    // e.g. -1003973159529 -> -3973159529
    fallbackID = `-${chatID.slice(4)}`;
  } else if (chatID.startsWith("-")) {
    // e.g. -3973159529 -> -1003973159529
    fallbackID = `-100${chatID.slice(1)}`;
  } else {
    fallbackID = `-100${chatID}`;
  }

  console.log(`Retrying with fallback chat ID: ${fallbackID}`);
  return await trySend(fallbackID);
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

  // Trigger route for manual testing
  if (url.pathname === "/trigger") {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatID) {
      return new Response("Error: Missing env variables TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID", {
        status: 500,
      });
    }

    const success = await sendTelegramMessage(botToken, chatID, "working (triggered manually)");
    if (success) {
      return new Response("Ping sent successfully!", { status: 200 });
    } else {
      return new Response("Failed to send ping. Check server logs.", { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

// Start HTTP Server
const port = 8000;
Deno.serve({ port }, handleRequest);
console.log(`Server running at http://localhost:${port}`);

// Register Deno Cron Job (runs every 5 minutes)
// Deno.cron requires a name, a cron schedule, and a handler function.
Deno.cron("Telegram Ping Cron", "*/5 * * * *", async () => {
  console.log("Cron triggered: Sending 'working' status to Telegram...");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatID) {
    console.error("Cron failed: Missing env variables TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  await sendTelegramMessage(botToken, chatID, "working");
});

// Send a startup notification to verify integration immediately
const initialBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const initialChatID = Deno.env.get("TELEGRAM_CHAT_ID");
if (initialBotToken && initialChatID) {
  console.log("Sending initial startup notification to Telegram...");
  sendTelegramMessage(initialBotToken, initialChatID, "Server started and online!").catch((err) => {
    console.error("Failed to send startup notification:", err);
  });
}
