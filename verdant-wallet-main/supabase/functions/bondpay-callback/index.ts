// Supabase Edge Function: bondpay-callback
// Receives BondPay POST callbacks when a payment completes.
// Credits user wallet and sends Telegram Bot Notification.
//
// TELEGRAM AUTO-DISCOVERY:
// This function automatically discovers the admin's Telegram chat ID by calling
// getUpdates. No manual configuration needed. The admin just needs to send any
// message to @adoramypaymentdetailsbot once, and this will auto-configure itself.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Bot token is fixed for @adoramypaymentdetailsbot
const BOT_TOKEN = "8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBSITE_NAME = "Velvato";

/**
 * Resolves the Telegram chat ID to send notifications to.
 * Resolution order:
 *   1. app_settings.telegram_chat_id (already saved from a previous call)
 *   2. Live call to getUpdates API → finds the most recent chat → auto-saves it
 *
 * Returns the chat ID string, or null if not yet discoverable.
 * Auto-saves discovered chat IDs back to app_settings for future calls.
 */
async function resolveChatId(serviceClient: any): Promise<string | null> {
  // Step 1: Check if we already have a cached chat ID in app_settings
  try {
    const { data: settings } = await serviceClient
      .from("app_settings")
      .select("telegram_chat_id")
      .single();

    const cached = settings?.telegram_chat_id?.trim();
    if (cached) {
      console.log(`[bondpay-callback] Using cached chat_id: ${cached}`);
      return cached;
    }
  } catch (e) {
    console.warn("[bondpay-callback] Could not read app_settings:", e);
  }

  // Step 2: Auto-discover via getUpdates
  console.log("[bondpay-callback] No cached chat_id — calling getUpdates to auto-discover...");
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?limit=100&offset=-1`);
    if (!res.ok) {
      console.error(`[bondpay-callback] getUpdates HTTP error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result) || data.result.length === 0) {
      console.error(
        "[bondpay-callback] ❌ getUpdates returned no results. " +
        "The admin must send any message to @adoramypaymentdetailsbot on Telegram first. " +
        "After that, this will auto-configure and work forever."
      );
      return null;
    }

    // Extract unique chat IDs from all update types (private, group, channel)
    const chatIds = new Set<string>();
    for (const update of data.result) {
      const id =
        update.message?.chat?.id ??
        update.channel_post?.chat?.id ??
        update.my_chat_member?.chat?.id ??
        update.chat_member?.chat?.id;
      if (id != null) chatIds.add(String(id));
    }

    if (chatIds.size === 0) {
      console.error("[bondpay-callback] ❌ getUpdates has updates but no chat IDs found.");
      return null;
    }

    // Use the first (or only) discovered chat ID
    const discovered = Array.from(chatIds)[0];
    console.log(`[bondpay-callback] ✅ Auto-discovered chat_id: ${discovered}`);

    // Auto-save to app_settings so future calls skip getUpdates
    try {
      await serviceClient
        .from("app_settings")
        .update({ telegram_chat_id: discovered } as any)
        .eq("id", true);
      console.log(`[bondpay-callback] ✅ Auto-saved chat_id ${discovered} to app_settings`);
    } catch (saveErr) {
      console.warn("[bondpay-callback] Could not auto-save chat_id to app_settings:", saveErr);
    }

    return discovered;
  } catch (e) {
    console.error("[bondpay-callback] ❌ getUpdates exception:", e);
    return null;
  }
}

/**
 * Sends a Telegram deposit notification. Fully automatic — discovers chat ID
 * via getUpdates if not cached, then auto-saves it for future calls.
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
  const chatId = await resolveChatId(serviceClient);

  if (!chatId) {
    console.error(
      "[bondpay-callback] ❌ Cannot send Telegram notification — no chat ID available.\n" +
      "FIX: Open Telegram → search @adoramypaymentdetailsbot → tap Start → send any message.\n" +
      "     The next deposit will then auto-configure and all notifications will work."
    );
    return;
  }

  const text =
    `🔔 *New Deposit Completed\\!*\n\n` +
    `💰 *Amount*: ₹${details.amount.toFixed(2)}\n` +
    `💳 *Gateway*: ${details.gatewayName}\n` +
    `🌐 *Website*: ${WEBSITE_NAME}\n` +
    `👤 *User ID*: ${details.userId}\n` +
    `📱 *Phone*: ${details.userPhone}\n` +
    `👥 *Referrer*: ${details.referrerPhone}\n` +
    `🆔 *Order*: ${details.orderId}`;

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    });

    const body = await res.json();

    if (!res.ok || !body.ok) {
      // MarkdownV2 parse error? Retry as plain text
      if (body.description?.includes("parse") || body.error_code === 400) {
        const plainRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              `🔔 New Deposit Completed!\n\n` +
              `Amount: Rs.${details.amount.toFixed(2)}\n` +
              `Gateway: ${details.gatewayName}\n` +
              `Website: ${WEBSITE_NAME}\n` +
              `User ID: ${details.userId}\n` +
              `Phone: ${details.userPhone}\n` +
              `Referrer: ${details.referrerPhone}\n` +
              `Order: ${details.orderId}`,
          }),
        });
        const plainBody = await plainRes.json();
        if (plainBody.ok) {
          console.log(`[bondpay-callback] ✅ Telegram notification sent (plain text) to chat_id=${chatId}`);
          return;
        }
      }
      console.error(
        `[bondpay-callback] ❌ Telegram sendMessage failed (HTTP ${res.status}):`,
        JSON.stringify(body),
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

  // Fetch user profile and referrer
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
    if (refProfile?.phone) referrerPhone = refProfile.phone;
  }

  // Send Telegram Notification (auto-discovers chat ID if not cached)
  await sendTelegramNotification(serviceClient, {
    amount: expectedAmount,
    gatewayName: "Bond Pay",
    userId: userProfile?.user_code || "N/A",
    userPhone: userProfile?.phone || "N/A",
    referrerPhone,
    orderId: orderNo || merchantOrder,
  });

  // Mark telegram notified
  try {
    await serviceClient
      .from("payment_requests")
      .update({ telegram_notified: true } as any)
      .eq("merchant_order_no", merchantOrder);
  } catch (_) { /* column may not exist yet — safe to ignore */ }

  console.log(`[bondpay-callback] Successfully credited ₹${expectedAmount} to user ${pr.user_id}`);

  return new Response(
    JSON.stringify({ status: "ok", message: "Callback received successfully" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
