# Deno Telegram Kick Live Notification Cron

A Deno application that monitors a Kick.com channel ("destiny") every 15 minutes and sends a live notification to a Telegram channel.

## Features

- **HTTP Server**: Serves a plain text `"online"` message on the root path `/`.
- **Destiny Live Check Cron**: Checks if `kick.com/destiny` is streaming every 15 minutes (`"*/15 * * * *"`).
- **Stateful Notification (No Database)**: Uses the Telegram channel's **pinned message** to store the state of the current stream session.
  - If live: It checks the stream ID in the pinned message. If it already matches the current stream, it skips sending duplicates. If new, it sends a new message and pins it.
  - If offline: If a stream notification is currently pinned, it unpins it to clean up the channel.
- **Manual Trigger / Testing**: Requesting the `/trigger` endpoint checks the stream status immediately and updates the state. Requesting `/trigger?force` overrides duplicate prevention and forces a new notification message.

## Setup & Running Locally

1. **Install Deno**: Make sure you have Deno installed.
2. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Provide your Telegram Bot Token and Chat ID:
   ```env
   TELEGRAM_BOT_TOKEN=8863547282:AAE2r9of0yB_iGSALp1V3tveysrgPOeWCBc
   TELEGRAM_CHAT_ID=-1003973159529
   ```
3. **Start the Dev Server**:
   ```bash
   deno task dev
   ```
   Or run it in production mode:
   ```bash
   deno task start
   ```

## Deploying to Deno Deploy

This project is fully ready to be deployed on [Deno Deploy](https://deno.com/deploy).

1. Connect this repository to your Deno Deploy project.
2. Configure the following environment variables in your project settings:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. Deploy the application with `main.ts` as the entrypoint. Deno Deploy will automatically detect and run the `Deno.cron` job.

*Note: Make sure your Telegram Bot is an Administrator in the destination channel/group and has the **"Pin Messages"** permission.*
