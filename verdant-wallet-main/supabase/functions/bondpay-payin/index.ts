// Supabase Edge Function: bondpay-payin
// Creates a BondPay payment order (Payin API) with MD5 signature.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "npm:md5";

const BONDPAY_ENDPOINT = "https://api.bond-payss.com/v1/create";
const MERCHANT_ID = "100888308";
const API_KEY = "8debe25c62f9c3a57a658bb132697393";

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
  return `BOND${ts}${rand}`;
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
    const callbackUrl = `${supabaseUrl}/functions/v1/bondpay-callback`;
    const amountStr = amount.toFixed(2);
    const merchantOrderNo = generateOrderNo();

    // BondPay Signature Formula:
    // md5( merchant_id + amount + merchant_order_no + api_key + callback_url )
    const signStr = `${MERCHANT_ID}${amountStr}${merchantOrderNo}${API_KEY}${callbackUrl}`;
    const signature = await hashMd5(signStr);

    const payload = {
      merchant_id: MERCHANT_ID,
      api_key: API_KEY,
      amount: amountStr,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl,
      extra: "0",
      signature,
    };

    console.log("[bondpay-payin] Sending request payload:", JSON.stringify(payload));

    const bpRes = await fetch(BONDPAY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const bpData = await bpRes.json();
    console.log("[bondpay-payin] API response:", JSON.stringify(bpData));

    if (!bpRes.ok || !bpData.success || !bpData.payment_url) {
      console.error("[bondpay-payin] API error:", bpData);
      return new Response(
        JSON.stringify({ error: bpData.message || "BondPay order creation failed" }),
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
      gateway_order_no: bpData.order_no ?? null,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: bpData.payment_url,
        merchant_order_no: merchantOrderNo,
        order_no: bpData.order_no,
        amount: amountStr,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[bondpay-payin] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
