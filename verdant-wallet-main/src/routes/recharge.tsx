import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Coins, Zap, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { WalletCard } from "@/components/ui-kit/WalletCard";
import { AmountInput } from "@/components/ui-kit/AmountInput";
import { PrimaryButton } from "@/components/ui-kit/Button";
import { EmptyState } from "@/components/ui-kit/Skeleton";
import { useProfile, useSettings, useDeposits, fmtDate } from "@/services/api";
import { INR } from "@/utils/format";
import { cn } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-pixel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recharge")({
  head: () => ({
    meta: [
      { title: "Recharge your Velvato wallet" },
      { name: "description", content: "Add funds to your Velvato wallet via UPI or bank transfer." },
      { property: "og:title", content: "Recharge your Velvato wallet" },
      { property: "og:description", content: "Fast, secure wallet top-ups in seconds." },
    ],
  }),
  component: RechargePage,
});

const methods = [
  { id: "upi", label: "UPI", icon: Smartphone, hint: "Instant · 0% fee" },
];

function RechargePage() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: deposits } = useDeposits();
  const [loading, setLoading] = useState(false);

  const presets = useMemo(() => settings?.recharge_presets ?? [], [settings]);
  const min = settings?.min_recharge ?? 0;
  const [amount, setAmount] = useState("");

  const proceed = async () => {
    const value = Number(amount) || 0;
    if (value < min) {
      toast.error(`Minimum recharge is ${INR(min)}`);
      return;
    }

    trackMetaEvent("InitiateCheckout", {
      content_category: "wallet_recharge",
      content_name: "Velvato wallet recharge",
      currency: "INR",
      value,
    });

    setLoading(true);
    try {
      // Get the current session token to authenticate the Edge Function call
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Please log in to recharge.");
        return;
      }

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/watchpay-payin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        },
        body: JSON.stringify({ amount: value }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not initiate payment. Please try again.");
        return;
      }

      // Redirect to WatchPay payment page in the same tab to avoid mobile popup blockers
      window.location.href = data.payment_url;
    } catch (err) {
      console.error("[recharge] Payment initiation failed:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell className="pb-48">
      <Header title="Recharge" />
      <div className="space-y-3 p-3">
        <WalletCard
          balance={profile?.balance ?? 0}
          badge={<><Lock className="size-4" /> Secured Wallet</>}
        />

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <SectionTitle className="flex items-center gap-2">
              <Coins className="size-6 text-primary" /> Select Amount
            </SectionTitle>
            {!!min && (
              <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary-dark">
                Min. {INR(min)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "rounded-2xl border border-border bg-card py-4 text-lg font-bold text-foreground transition-colors",
                  amount === String(p) && "border-primary bg-primary-soft text-primary-dark",
                )}
              >
                {INR(p)}
              </button>
            ))}
          </div>
          <AmountInput value={amount} onChange={setAmount} currency="₹" />
        </Card>

        <Card className="space-y-2.5 p-4">
          <SectionTitle>Payment method</SectionTitle>
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border border-border p-4 text-left",
                "border-primary bg-primary-soft",
              )}
            >
              <m.icon className="size-6 text-primary" />
              <span className="flex-1">
                <span className="block font-bold text-foreground">{m.label}</span>
                <span className="block text-sm text-muted-foreground">{m.hint}</span>
              </span>
              <span
                className={cn(
                  "size-5 rounded-full border-2 border-border",
                  "border-primary bg-primary",
                )}
              />
            </button>
          ))}
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-3">Recent recharges</SectionTitle>
          {deposits?.length ? (
            <ul className="space-y-3">
              {deposits.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span>
                    <span className="block font-semibold text-foreground">UTR {d.utr}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtDate(d.created_at)} · {d.status}
                    </span>
                  </span>
                  <span className="font-bold text-primary-dark">{INR(d.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No recharges yet" />
          )}
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto w-full max-w-[520px] px-4">
        <PrimaryButton onClick={proceed} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Processing…
            </span>
          ) : (
            <><Zap className="size-5" /> Go to Recharge</>
          )}
        </PrimaryButton>
      </div>
    </MobileShell>
  );
}
