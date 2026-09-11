import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Coins, Zap, Smartphone, X, CheckCircle2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recharge")({
  head: () => ({
    meta: [
      { title: "Recharge your Velvato wallet" },
      {
        name: "description",
        content: "Add funds to your Velvato wallet via Bond Pay or MPX Pay.",
      },
      { property: "og:title", content: "Recharge your Velvato wallet" },
      { property: "og:description", content: "Fast, secure wallet top-ups in seconds." },
    ],
  }),
  component: RechargePage,
});

const CHANNELS = [
  {
    id: "bondpay",
    name: "CHANNEL - 1",
    label: "Bond Pay (Default)",
    hint: "Instant UPI · 0% Fee",
    icon: Smartphone,
  },
  {
    id: "mpxpay",
    name: "CHANNEL - 2",
    label: "MPX Pay",
    hint: "Fast & Secure UPI · 0% Fee",
    icon: Smartphone,
  },
] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];

function RechargePage() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { data: deposits } = useDeposits();

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>("bondpay");

  const presets = useMemo(() => settings?.recharge_presets ?? [], [settings]);
  const min = settings?.min_recharge ?? 0;
  const [amount, setAmount] = useState("");

  const callGateway = async (gw: ChannelId, value: number, token: string): Promise<string> => {
    const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
    const apikey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
    const fnName = gw === "bondpay" ? "bondpay-payin" : "mpxpay-payin";

    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey,
      },
      body: JSON.stringify({ amount: value }),
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.payment_url) {
      throw new Error(data.error || `${fnName} failed`);
    }

    return data.payment_url as string;
  };

  const handleOpenModal = () => {
    const value = Number(amount) || 0;
    if (value < min) {
      toast.error(`Minimum recharge is ${INR(min)}`);
      return;
    }
    setShowModal(true);
  };

  const proceedPayment = async () => {
    const value = Number(amount) || 0;
    if (value < min) {
      toast.error(`Minimum recharge is ${INR(min)}`);
      return;
    }

    import("@/lib/meta-pixel").then(({ trackMetaEvent }) => {
      trackMetaEvent("InitiateCheckout", {
        content_category: "wallet_recharge",
        content_name: "Velvato wallet recharge",
        currency: "INR",
        value,
      });
    });

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Please log in to recharge.");
        setLoading(false);
        return;
      }

      let paymentUrl: string | null = null;
      let usedGateway = selectedChannel;

      // Try the selected channel first
      try {
        paymentUrl = await callGateway(selectedChannel, value, token);
      } catch (primaryErr) {
        console.warn(`[recharge] Primary channel (${selectedChannel}) failed:`, primaryErr);
        toast.info("Switching to backup payment channel…");

        // Auto-fallback to the other channel
        const fallback: ChannelId = selectedChannel === "bondpay" ? "mpxpay" : "bondpay";
        try {
          paymentUrl = await callGateway(fallback, value, token);
          usedGateway = fallback;
        } catch (fallbackErr) {
          console.error("[recharge] Fallback channel also failed:", fallbackErr);
          toast.error("Payment service is temporarily unavailable. Please try again shortly.");
          setLoading(false);
          return;
        }
      }

      console.log(`[recharge] Redirecting via ${usedGateway}:`, paymentUrl);
      window.location.href = paymentUrl!;
    } catch (err) {
      console.error("[recharge] Payment initiation failed:", err);
      toast.error("Something went wrong. Please try again.");
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
        <PrimaryButton onClick={handleOpenModal} disabled={loading}>
          <><Zap className="size-5" /> Go to Recharge</>
        </PrimaryButton>
      </div>

      {/* Payment Gateway Selection Modal / Popup */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md animate-in slide-in-from-bottom-5 rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Select Payment Channel</h3>
                <p className="text-xs text-muted-foreground">
                  Recharge Amount: <span className="font-extrabold text-primary-dark">{INR(Number(amount) || 0)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !loading && setShowModal(false)}
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="my-5 space-y-3">
              {CHANNELS.map((ch) => {
                const isSelected = selectedChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary-soft shadow-sm"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={cn(
                          "flex size-11 items-center justify-center rounded-xl",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <ch.icon className="size-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-foreground">{ch.name}</span>
                          {ch.id === "bondpay" && (
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary-dark">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <span className="block text-xs font-semibold text-muted-foreground">
                          {ch.hint}
                        </span>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="size-6 text-primary fill-primary text-card" />
                    ) : (
                      <div className="size-5 rounded-full border-2 border-border" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <PrimaryButton onClick={proceedPayment} disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Processing Payment…
                  </span>
                ) : (
                  <>Pay Now {INR(Number(amount) || 0)}</>
                )}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
