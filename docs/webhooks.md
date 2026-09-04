# Webhook Configuration

Mailing uses webhooks to receive real-time updates from Resend regarding email delivery, bounces, and incoming mail.

## How It Works

This application exposes an endpoint at `POST /api/webhooks/resend` to handle these events.
Because multiple users might use the same deployment, the endpoint needs to know *which* user the webhook is intended for in order to look up the correct webhook secret for signature verification.

## Setup Instructions

1. Go to your [Resend Dashboard](https://resend.com/webhooks).
2. Click **Add Webhook**.
3. In the **Endpoint URL** field, enter the URL of your deployed application:
   
   Example:
   `https://your-domain.com/api/webhooks/resend`
   
   *(Note: Query parameter `?userId=YOUR_USER_ID` is also optionally supported if you have multiple isolated users).*

4. Select the events you want to track (e.g., `email.delivered`, `email.bounced`, `email.received`, etc.).
5. Click **Add**.
6. After creation, Resend will provide a **Signing Secret** (it usually starts with `whsec_`).
7. Copy this secret.
8. Open your Mailing Client app, navigate to **Settings > API Keys**.
9. Edit or add your Resend provider config, and paste the Signing Secret into the **Webhook signing secret** field.

## Security

All webhook payloads are verified using [Svix](https://www.svix.com/). If the signature is missing or invalid, the app will reject the request with a `401 Unauthorized`. The app also ensures idempotency by tracking the `svix-id` of each processed event, preventing duplicate processing if Resend retries delivery.
