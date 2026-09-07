// Supabase Edge Function: rspay-callback
// Receives RS Payment Gateway POST webhooks when a payment completes.
// Verifies the order, avoids duplicates, and credits the user wallet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RS_MERCHANT_ID = "INR70438";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, string> = {};
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

  console.log("[rspay-callback] Received payload:", JSON.stringify(body));

  // Per RS Payment docs: status, user_id (merchant ID), merchant_order_id, amount
  const status = body.status;
  const userId = body.user_id;
  const merchantOrderId = body.merchant_order_id;
  const amount = body.amount;

  // Only process successful payments
  if (String(status).toLowerCase() !== "success") {
    console.log("[rspay-callback] Ignoring non-success status:", status);
    return new Response("SUCCESS", { status: 200 });
  }

  // Verify this webhook is for our merchant
  if (userId !== RS_MERCHANT_ID) {
    console.error("[rspay-callback] Merchant ID mismatch:", userId);
    return new Response("INVALID_REQUEST", { status: 403 });
  }

  if (!merchantOrderId || amount == null) {
    console.error("[rspay-callback] Missing required fields:", body);
    return new Response("INVALID_REQUEST", { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the pending payment request
  const { data: pr, error: prErr } = await serviceClient
    .from("payment_requests")
    .select("*")
    .eq("merchant_order_no", merchantOrderId)
    .single();

  if (prErr || !pr) {
    console.error("[rspay-callback] Payment request not found:", merchantOrderId, prErr);
    return new Response("INVALID_REQUEST", { status: 404 });
  }

  // Avoid duplicate processing
  if (pr.status === "completed") {
    console.log("[rspay-callback] Already processed:", merchantOrderId);
    return new Response("SUCCESS", { status: 200 });
  }

  // Verify amount matches
  const callbackAmount = Number(amount);
  const expectedAmount = Number(pr.amount);
  if (Math.abs(callbackAmount - expectedAmount) > 1) {
    console.error("[rspay-callback] Amount mismatch: expected", expectedAmount, "got", callbackAmount);
    return new Response("INVALID_REQUEST", { status: 400 });
  }

  // Mark payment request as completed
  await serviceClient
    .from("payment_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("merchant_order_no", merchantOrderId);

  // Credit the user wallet using admin_credit_wallet RPC
  const { error: balErr } = await serviceClient.rpc("admin_credit_wallet", {
    p_user_id: pr.user_id,
    p_amount: expectedAmount,
    p_note: "RS Payment deposit — order " + merchantOrderId,
  });

  if (balErr) {
    console.warn("[rspay-callback] admin_credit_wallet RPC failed, using fallback:", balErr);

    // Fallback: directly insert deposit + transaction records
    await serviceClient.from("deposits").insert({
      user_id: pr.user_id,
      amount: expectedAmount,
      utr: merchantOrderId,
      status: "approved",
      admin_note: "Auto-credited by RS Payment",
    });

    await serviceClient.from("transactions").insert({
      user_id: pr.user_id,
      type: "deposit",
      amount: expectedAmount,
      status: "success",
      note: "RS Payment deposit — " + merchantOrderId,
    });

    // Direct balance update as last resort
    await serviceClient.rpc("increment_balance", {
      user_id: pr.user_id,
      delta: expectedAmount,
    });
  }

  // Send notification to user
  await serviceClient.from("notifications").insert({
    user_id: pr.user_id,
    title: "Recharge Successful",
    body: `Rs. ${expectedAmount.toFixed(2)} has been added to your wallet.`,
  });

  console.log("[rspay-callback] Successfully credited Rs.", expectedAmount, "to user", pr.user_id);

  return new Response("SUCCESS", { status: 200 });
});
