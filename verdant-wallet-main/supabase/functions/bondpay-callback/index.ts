// Supabase Edge Function: bondpay-callback
// Receives BondPay POST callbacks when a payment completes.
// Credits user wallet and sends Telegram Bot Notification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBSITE_NAME = "Velvato";

/**
 * Sends a Telegram message to the configured admin chat.
 *
 * Chat ID resolution order (most to least reliable):
 *  1. TELEGRAM_CHAT_ID env secret (set in Supabase Edge Function secrets)
 *  2. app_settings.telegram_chat_id (configurable via Admin → Settings panel)
 *  3. app_settings.telegram_bot_token (if different from env secret)
 *
 * Bot token resolution order:
 *  1. TELEGRAM_BOT_TOKEN env secret
 *  2. app_settings.telegram_bot_token
 *
 * If neither source has a chat ID or bot token, a clear error is logged.
 */
async function sendTelegramNotification(
  serviceClient: any,
  details: {
    amount: number;
    gatewayName: string;
    userId: string;
    userPhone: string;
    referrerPhone: string;
    orderId: string;
  },
): Promise<void> {
  // ── 1. Resolve bot token ──────────────────────────────────────────────────
  let botToken: string =
    Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

  // ── 2. Resolve chat ID ───────────────────────────────────────────────────
  let chatId: string =
    Deno.env.get("TELEGRAM_CHAT_ID") || "";

  // ── 3. Fall back to app_settings if env secrets are not set ─────────────
  if (!chatId || !botToken) {
    try {
      const { data: settings, error: settingsErr } = await serviceClient
        .from("app_settings")
        .select("telegram_chat_id, telegram_bot_token")
        .single();

      if (settingsErr) {
        console.error("[bondpay-callback] Failed to read app_settings:", settingsErr.message);
      } else {
        if (!chatId && settings?.telegram_chat_id) {
          chatId = String(settings.telegram_chat_id).trim();
        }
        if (!botToken && settings?.telegram_bot_token) {
          botToken = String(settings.telegram_bot_token).trim();
        }
      }
    } catch (e) {
      console.error("[bondpay-callback] Exception reading app_settings:", e);
    }
  }

  // ── 4. Validate ──────────────────────────────────────────────────────────
  if (!botToken) {
    console.error(
      "[bondpay-callback] ❌ Telegram bot token is not configured. " +
      "Set TELEGRAM_BOT_TOKEN in Supabase Edge Function secrets, OR set " +
      "telegram_bot_token in Admin → Settings. Notification NOT sent.",
    );
    return;
  }

  if (!chatId) {
    console.error(
      "[bondpay-callback] ❌ Telegram chat ID is not configured. " +
      "Set TELEGRAM_CHAT_ID in Supabase Edge Function secrets, OR set " +
      "telegram_chat_id in Admin → Settings. Notification NOT sent.",
    );
    return;
  }

  // ── 5. Build message ─────────────────────────────────────────────────────
  const text =
    `🔔 *New Deposit Completed!*\n\n` +
    `💰 *Deposit Amount*: ₹${details.amount.toFixed(2)}\n` +
    `💳 *Gateway Name*: ${details.gatewayName}\n` +
    `🌐 *Website Name*: ${WEBSITE_NAME}\n` +
    `👤 *User ID*: ${details.userId}\n` +
    `📱 *User Phone*: ${details.userPhone}\n` +
    `👥 *Referrer Phone*: ${details.referrerPhone}\n` +
    `🆔 *Order ID*: ${details.orderId}`;

  // ── 6. Send ───────────────────────────────────────────────────────────────
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );

    const resBody = await res.json();

    if (!res.ok || !resBody.ok) {
      console.error(
        `[bondpay-callback] ❌ Telegram sendMessage failed (HTTP ${res.status}):`,
        JSON.stringify(resBody),
      );
    } else {
      console.log(`[bondpay-callback] ✅ Telegram notification sent to chat_id=${chatId}`);
    }
  } catch (err) {
    console.error("[bondpay-callback] ❌ Telegram sendMessage exception:", err);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, any> = {};
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
    } else {
      body = await req.json();
    }
  } catch {
    return new Response("Bad request body", { status: 400 });
  }

  console.log("[bondpay-callback] Received payload:", JSON.stringify(body));

  const orderNo = body.orderNo || body.order_no;
  const merchantOrder = body.merchantOrder || body.merchant_order_no;
  const status = String(body.status || "").toLowerCase();
  const amount = body.amount;

  if (status !== "success" && status !== "1" && status !== "paid") {
    console.log(`[bondpay-callback] Ignoring status: ${status}`);
    return new Response(
      JSON.stringify({ status: "ok", message: "Callback received (non-success status)" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!merchantOrder || amount == null) {
    console.error("[bondpay-callback] Missing required fields:", body);
    return new Response("Bad request: missing fields", { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pr, error: prErr } = await serviceClient
    .from("payment_requests")
    .select("*")
    .eq("merchant_order_no", merchantOrder)
    .single();

  if (prErr || !pr) {
    console.error("[bondpay-callback] Payment request not found:", merchantOrder, prErr);
    return new Response("Order not found", { status: 404 });
  }

  if (pr.status === "completed") {
    console.log("[bondpay-callback] Already processed:", merchantOrder);
    return new Response(
      JSON.stringify({ status: "ok", message: "Callback received successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const expectedAmount = Number(pr.amount);

  // Update payment_request status
  await serviceClient
    .from("payment_requests")
    .update({
      status: "completed",
      gateway_order_no: orderNo || null,
      completed_at: new Date().toISOString(),
    })
    .eq("merchant_order_no", merchantOrder);

  // Credit user's wallet balance
  const { error: balErr } = await serviceClient.rpc("admin_credit_wallet", {
    p_user_id: pr.user_id,
    p_amount: expectedAmount,
    p_note: `Bond Pay deposit — order ${orderNo || merchantOrder}`,
  });

  if (balErr) {
    console.warn("[bondpay-callback] admin_credit_wallet RPC failed, applying fallback:", balErr);
    await serviceClient.from("deposits").insert({
      user_id: pr.user_id,
      amount: expectedAmount,
      utr: orderNo || merchantOrder,
      status: "approved",
      admin_note: "Auto-credited by Bond Pay",
    });

    await serviceClient.from("transactions").insert({
      user_id: pr.user_id,
      type: "recharge",
      amount: expectedAmount,
      status: "success",
      note: `Bond Pay deposit — order ${orderNo || merchantOrder}`,
    });
  }

  // Insert user notification
  await serviceClient.from("notifications").insert({
    user_id: pr.user_id,
    title: "Recharge Successful",
    body: `₹${expectedAmount.toFixed(2)} has been credited to your wallet via Bond Pay.`,
  });

  // Fetch user profile and referrer profile for Telegram Notification
  const { data: userProfile } = await serviceClient
    .from("profiles")
    .select("phone, user_code, referred_by")
    .eq("id", pr.user_id)
    .single();

  let referrerPhone = "None";
  if (userProfile?.referred_by) {
    const { data: refProfile } = await serviceClient
      .from("profiles")
      .select("phone")
      .eq("id", userProfile.referred_by)
      .single();
    if (refProfile?.phone) {
      referrerPhone = refProfile.phone;
    }
  }

  // Send Telegram Notification
  await sendTelegramNotification(serviceClient, {
    amount: expectedAmount,
    gatewayName: "Bond Pay",
    userId: userProfile?.user_code || "N/A",
    userPhone: userProfile?.phone || "N/A",
    referrerPhone,
    orderId: orderNo || merchantOrder,
  });

  // Mark this payment request as telegram-notified
  await serviceClient
    .from("payment_requests")
    .update({ telegram_notified: true })
    .eq("merchant_order_no", merchantOrder);

  console.log(`[bondpay-callback] Successfully credited ₹${expectedAmount} to user ${pr.user_id}`);

  return new Response(
    JSON.stringify({ status: "ok", message: "Callback received successfully" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
