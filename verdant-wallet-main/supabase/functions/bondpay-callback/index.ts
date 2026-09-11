// Supabase Edge Function: bondpay-callback
// Receives BondPay POST callbacks when a payment completes.
// Credits user wallet and sends Telegram Bot Notification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = "8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo";
const WEBSITE_NAME = "Velvato";

async function sendTelegramNotification(
  serviceClient: any,
  details: {
    amount: number;
    gatewayName: string;
    userId: string;
    userPhone: string;
    referrerPhone: string;
  },
) {
  try {
    const text =
      `🔔 *New Deposit Completed!*\n\n` +
      `💰 *Deposit Amount*: ₹${details.amount.toFixed(2)}\n` +
      `💳 *Gateway Name*: ${details.gatewayName}\n` +
      `🌐 *Website Name*: ${WEBSITE_NAME}\n` +
      `👤 *User ID*: ${details.userId}\n` +
      `📱 *User Phone*: ${details.userPhone}\n` +
      `👥 *Referrer Phone*: ${details.referrerPhone}`;

    let chatIds: string[] = [];

    // Check if telegram_chat_id is defined in app_settings
    try {
      const { data: settings } = await serviceClient
        .from("app_settings")
        .select("*")
        .single();
      if (settings?.telegram_chat_id) {
        chatIds.push(String(settings.telegram_chat_id));
      }
    } catch {
      // ignore
    }

    // If no custom chat_id, attempt getUpdates to find chat ID(s)
    if (chatIds.length === 0) {
      try {
        const uRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData.result && Array.isArray(uData.result)) {
            const set = new Set<string>();
            for (const item of uData.result) {
              const cid =
                item.message?.chat?.id ||
                item.channel_post?.chat?.id ||
                item.my_chat_member?.chat?.id;
              if (cid) set.add(String(cid));
            }
            chatIds = Array.from(set);
          }
        }
      } catch (e) {
        console.warn("[bondpay-callback] Failed to get telegram updates:", e);
      }
    }

    if (chatIds.length === 0) {
      console.warn("[bondpay-callback] No telegram chat_id found to send message");
      return;
    }

    for (const cid of chatIds) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cid,
          text,
          parse_mode: "Markdown",
        }),
      });
    }
  } catch (err) {
    console.error("[bondpay-callback] Telegram notification error:", err);
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
    await serviceClient
      .from("profiles")
      .update({
        balance: serviceClient.rpc("balance", {}) as unknown as number,
      })
      .eq("id", pr.user_id);

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
  });

  console.log(`[bondpay-callback] Successfully credited ₹${expectedAmount} to user ${pr.user_id}`);

  return new Response(
    JSON.stringify({ status: "ok", message: "Callback received successfully" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
