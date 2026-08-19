import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Banknote, Info, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { WalletCard } from "@/components/ui-kit/WalletCard";
import { AmountInput, PercentageButtons } from "@/components/ui-kit/AmountInput";
import { PasswordInput } from "@/components/ui-kit/Input";
import { PrimaryButton, Button } from "@/components/ui-kit/Button";
import { useProfile, useSettings } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { INR2 } from "@/utils/format";
import { trackMetaCustomEvent } from "@/lib/meta-pixel";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw funds — Velvato" },
      { name: "description", content: "Withdraw your Velvato balance to your linked bank account." },
      { property: "og:title", content: "Withdraw funds — Velvato" },
      { property: "og:description", content: "Fast payouts with transparent tax calculation." },
    ],
  }),
  component: WithdrawPage,
});

function WithdrawPage() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const balance = profile?.balance ?? 0;
  const taxPercent = settings?.tax_percent ?? 0;
  const min = settings?.min_withdraw ?? 0;
  const value = Number(amount) || 0;
  const tax = (value * taxPercent) / 100;

  const submit = async () => {
    if (value < min) {
      toast.error(`Minimum withdrawal is ${INR2(min)}`);
      return;
    }
    if (value > balance) {
      toast.error("Amount exceeds available balance");
      return;
    }
    if (!password) {
      toast.error("Enter your withdrawal password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("request_withdrawal", {
      _amount: value,
      _password: password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount("");
    setPassword("");
    await qc.invalidateQueries();
    trackMetaCustomEvent("WithdrawalSubmitted", {
      currency: "INR",
      value,
    });
    toast.success("Withdrawal submitted for review");
  };

  return (
    <MobileShell className="pb-48">
      <Header title="Withdraw" />
      <div className="space-y-3 p-3 pb-24">
        <WalletCard
          balance={balance}
          prefix="INR"
          badge={<><Shield className="size-4" /> Withdrawable</>}
        />

        <Card className="space-y-5 p-5">
          <SectionTitle className="flex items-center gap-2">
            <Banknote className="size-6 text-primary" /> Withdrawal Amount
          </SectionTitle>
          <PercentageButtons
            balance={balance}
            active={value}
            onSelect={(v) => setAmount(String(v))}
          />
          <AmountInput value={amount} onChange={setAmount} />
          <PasswordInput
            placeholder="Enter withdrawal password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leading={<Lock className="size-6 text-primary" />}
          />
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Info className="size-4 text-primary" /> Minimum withdrawal: {INR2(min)}
          </p>
          <div className="flex items-center justify-between rounded-2xl bg-primary-soft/60 p-5">
            <span>
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tax ({taxPercent}%)
              </span>
              <span className="mt-1 block text-xl font-extrabold text-foreground">{INR2(tax)}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                You receive
              </span>
              <span className="mt-1 block text-xl font-extrabold text-primary-dark">
                {INR2(Math.max(0, value - tax))}
              </span>
            </span>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-5">
          <span>
            <SectionTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-primary" /> Payout account
            </SectionTitle>
            <span className="mt-1 block text-sm text-muted-foreground">
              {profile?.upi_id || profile?.account_number || "Not added yet"}
            </span>
          </span>
          <Link to="/profile/bank">
            <Button variant="outline" size="sm" className="border-primary text-primary-dark">
              Change
            </Button>
          </Link>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto w-full max-w-[520px] px-4">
        <PrimaryButton loading={loading} onClick={submit}>
          <Upload className="size-5" /> Submit Withdrawal
        </PrimaryButton>
      </div>
    </MobileShell>
  );
}
