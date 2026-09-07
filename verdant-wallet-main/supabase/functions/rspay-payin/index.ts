// Supabase Edge Function: rspay-payin
// Creates an RS Payment Gateway order via their GET API.
// No signature required — simple GET request with params.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RS_MERCHANT_ID = "INR70438";
const RS_ENDPOINT = "https://rspayment.shop/api.php";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOrderNo(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `RSP${ts}${rand}`;
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    const merchantOrderNo = generateOrderNo();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/rspay-callback`;
    const returnUrl = "https://verdant-ice2.vercel.app/";

    const apiUrl = new URL(RS_ENDPOINT);
    apiUrl.searchParams.set("amount", String(amount));
    apiUrl.searchParams.set("user_id", RS_MERCHANT_ID);
    apiUrl.searchParams.set("order_id", merchantOrderNo);
    apiUrl.searchParams.set("ext", "VelvatoPay");
    apiUrl.searchParams.set("webhook_url", callbackUrl);
    apiUrl.searchParams.set("return_url", returnUrl);

    console.log("[rspay-payin] Calling RS Payment API:", apiUrl.toString());

    const rsRes = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const rsData = await rsRes.json();
    console.log("[rspay-payin] API response:", JSON.stringify(rsData));

    if (!rsRes.ok || rsData.status !== "success") {
      const errMsg = rsData.message || (rsData.gateway_response && rsData.gateway_response.message) || "RS Payment order creation failed";
      console.error("[rspay-payin] API error:", rsData);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payUrl = rsData.data && rsData.data.payUrl;
    const platformOrderId = rsData.data && rsData.data.platform_order_id;

    if (!payUrl) {
      return new Response(JSON.stringify({ error: "No payment URL returned from gateway" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await serviceClient.from("payment_requests").insert({
      user_id: user.id,
      amount,
      merchant_order_no: merchantOrderNo,
      gateway_order_no: platformOrderId || null,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: payUrl,
        merchant_order_no: merchantOrderNo,
        order_no: platformOrderId,
        amount: String(amount),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[rspay-payin] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
