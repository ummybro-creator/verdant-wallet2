// Supabase Edge Function: watchpay-payin
// Creates a WatchPay payment order (Payin API) with proper MD5 signature.
// Called from the client recharge page; keeps the API key server-side.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WATCHPAY_ENDPOINT = "https://api.watchpays.com/v1/create";
const MERCHANT_ID = "100555450";
const API_KEY = "ecdc22888b6ce064a4bc3fa9739e31d0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import md5 from "npm:md5";

// We use the npm:md5 package which works flawlessly in Deno Deploy / Supabase Edge Functions.
async function hashMd5(message: string): Promise<string> {
  return md5(message);
}

function generateOrderNo(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `VLT${ts}${rand}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine callback URL (WatchPay will POST here on payment success)
    const siteUrl = Deno.env.get("SITE_URL") || "https://xihslaahlgvlggolkbqh.supabase.co";
    const callbackUrl = `${siteUrl}/functions/v1/watchpay-callback`;
    const returnUrl = "https://verdant-ice2.vercel.app/";

    const amountStr = amount.toFixed(2);
    const merchantOrderNo = generateOrderNo();

    // Build signature per WatchPay spec:
    // Step 1-3: Collect params, remove empty, sort alphabetically
    const params: Record<string, string> = {
      amount: amountStr,
      callback_url: callbackUrl,
      merchant_id: MERCHANT_ID,
      merchant_order_no: merchantOrderNo,
      return_url: returnUrl,
    };
    const sortedKeys = Object.keys(params).sort();

    // Step 4-5: Build string & append key
    let signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    signStr += `&key=${API_KEY}`;

    // Step 6: MD5 hash
    const signature = await hashMd5(signStr);

    // Call WatchPay API
    const payload = {
      merchant_id: MERCHANT_ID,
      api_key: API_KEY,
      amount: amountStr,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl,
      return_url: returnUrl,
      extra: user.id, // store user id for callback processing
      signature,
    };

    const wpRes = await fetch(WATCHPAY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const wpData = await wpRes.json();

    if (!wpRes.ok || !wpData.success) {
      console.error("[watchpay-payin] API error:", wpData);
      return new Response(
        JSON.stringify({ error: wpData.message || "WatchPay order creation failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Persist the pending payment_request in the DB so we can reconcile on callback
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await serviceClient.from("payment_requests").insert({
      user_id: user.id,
      amount,
      merchant_order_no: merchantOrderNo,
      gateway_order_no: wpData.order_no ?? null,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: wpData.payment_url,
        merchant_order_no: merchantOrderNo,
        order_no: wpData.order_no,
        amount: amountStr,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[watchpay-payin] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
