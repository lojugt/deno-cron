# Deno Telegram Cron Ping

A simple Deno application that serves a basic HTTP homepage and runs a cron job to ping a Telegram channel.

## Features

- **HTTP Server**: Serves a plain text `"online"` message on the root path `/`.
- **Telegram Cron Job**: Pings a Telegram channel every 5 minutes with the text `"working"`.
- **Manual Trigger**: Requesting the `/trigger` endpoint manually sends a test message to the Telegram channel.
- **Robust Connection Fallback**: Built-in fallback logic that automatically prefixes/removes the `-100` chat ID prefix if the primary attempt fails.

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
