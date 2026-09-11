// Supabase Edge Function: mpxpay-payin
// Creates an MPX Pay payment order (PayIn API) with MD5 signature.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "npm:md5";

const MPXPAY_ENDPOINT = "https://api.mpxpays.com/api/payIn";
const MERCHANT_ID = "953010";
const API_KEY = "cf32923f2dae716bd29030025410149b7ed017b01e182c1aadcbb8f97c21a305";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashMd5(message: string): Promise<string> {
  return md5(message);
}

function generateOrderNo(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `MPX${ts}${rand}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/mpxpay-callback`;
    const amountStr = amount.toFixed(2);
    const merchantOrderNo = generateOrderNo();

    // MPXPay Signature Formula:
    // md5(api_key + amount.toFixed(2) + callback_url + merchant_id + merchant_order_no)
    const signStr = `${API_KEY}${amountStr}${callbackUrl}${MERCHANT_ID}${merchantOrderNo}`;
    const signature = await hashMd5(signStr);

    // Send amountStr ("290.00") as string to prevent IEEE 754 floating point precision drift/deductions
    const payload = {
      merchant_id: MERCHANT_ID,
      api_key: API_KEY,
      amount: amountStr,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl,
      currency: "INR",
      signature,
    };

    console.log("[mpxpay-payin] Sending request payload:", JSON.stringify(payload));

    const mpxRes = await fetch(MPXPAY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const mpxData = await mpxRes.json();
    console.log("[mpxpay-payin] API response:", JSON.stringify(mpxData));

    if (!mpxRes.ok || mpxData.status !== 1 || !mpxData.url) {
      console.error("[mpxpay-payin] API error:", mpxData);
      return new Response(
        JSON.stringify({ error: mpxData.message || "MPX Pay order creation failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await serviceClient.from("payment_requests").insert({
      user_id: user.id,
      amount,
      merchant_order_no: merchantOrderNo,
      gateway_order_no: mpxData.platform_order_no ?? null,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: mpxData.url,
        merchant_order_no: merchantOrderNo,
        order_no: mpxData.platform_order_no,
        amount: amountStr,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[mpxpay-payin] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
