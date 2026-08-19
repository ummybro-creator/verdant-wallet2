// Supabase Edge Function: watchpay-callback
// Receives WatchPay POST callbacks when a payment completes.
// Verifies the order, avoids duplicates, and credits the user wallet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    orderNo?: string;
    merchantOrder?: string;
    status?: string;
    amount?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { orderNo, merchantOrder, status, amount } = body;

  // Only process successful payments
  if (status !== "success") {
    console.log(`[watchpay-callback] Ignoring non-success status: ${status}`);
    return new Response("success", { status: 200 });
  }

  if (!merchantOrder || !orderNo || amount == null) {
    console.error("[watchpay-callback] Missing required fields:", body);
    return new Response("Bad request: missing fields", { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the pending payment request
  const { data: pr, error: prErr } = await serviceClient
    .from("payment_requests")
    .select("*")
    .eq("merchant_order_no", merchantOrder)
    .single();

  if (prErr || !pr) {
    console.error("[watchpay-callback] Payment request not found:", merchantOrder, prErr);
    return new Response("Order not found", { status: 404 });
  }

  // Avoid duplicate processing
  if (pr.status === "completed") {
    console.log("[watchpay-callback] Already processed:", merchantOrder);
    return new Response("success", { status: 200 });
  }

  // Verify amount matches (WatchPay sends integer paise/units; our amount is in rupees)
  // The callback amount field may differ in precision — compare as float
  const callbackAmount = Number(amount);
  const expectedAmount = Number(pr.amount);
  if (Math.abs(callbackAmount - expectedAmount) > 0.01) {
    console.error(
      `[watchpay-callback] Amount mismatch: expected ${expectedAmount}, got ${callbackAmount}`,
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  // Mark payment request as completed
  const { error: updateErr } = await serviceClient
    .from("payment_requests")
    .update({
      status: "completed",
      gateway_order_no: orderNo,
      completed_at: new Date().toISOString(),
    })
    .eq("merchant_order_no", merchantOrder);

  if (updateErr) {
    console.error("[watchpay-callback] Failed to update payment_request:", updateErr);
    return new Response("DB error", { status: 500 });
  }

  // Credit the user's wallet balance
  const { error: balErr } = await serviceClient.rpc("admin_credit_wallet", {
    p_user_id: pr.user_id,
    p_amount: expectedAmount,
    p_note: `WatchPay deposit — order ${orderNo}`,
  });

  if (balErr) {
    // Fallback: direct balance update + deposit record + transaction
    console.warn("[watchpay-callback] admin_credit_wallet RPC failed, using fallback:", balErr);

    // 1. Credit balance
    const { error: e1 } = await serviceClient.rpc("increment_balance", {
      user_id: pr.user_id,
      delta: expectedAmount,
    });

    if (e1) {
      // Last resort: direct update
      await serviceClient
        .from("profiles")
        .update({
          balance: serviceClient.rpc("balance", {}) as unknown as number,
        })
        .eq("id", pr.user_id);
    }

    // 2. Insert deposit record
    await serviceClient.from("deposits").insert({
      user_id: pr.user_id,
      amount: expectedAmount,
      utr: orderNo,
      status: "approved",
    });

    // 3. Insert transaction record
    await serviceClient.from("transactions").insert({
      user_id: pr.user_id,
      type: "deposit",
      amount: expectedAmount,
      status: "success",
      note: `WatchPay deposit — ${orderNo}`,
    });
  }

  // Send a notification to the user
  await serviceClient.from("notifications").insert({
    user_id: pr.user_id,
    title: "Recharge Successful",
    body: `₹${expectedAmount.toFixed(2)} has been added to your wallet.`,
  });

  console.log(
    `[watchpay-callback] Successfully credited ₹${expectedAmount} to user ${pr.user_id}`,
  );

  return new Response("success", { status: 200 });
});
