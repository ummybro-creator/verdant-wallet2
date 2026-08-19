import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { WalletCard, StatisticCard } from "@/components/ui-kit/WalletCard";
import { Button } from "@/components/ui-kit/Button";
import { EmptyState } from "@/components/ui-kit/Skeleton";
import { useProfile, useTransactions, fmtDate } from "@/services/api";
import { INR } from "@/utils/format";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Velvato balance and income" },
      {
        name: "description",
        content: "See your Velvato balance, recharge total and income summary.",
      },
      { property: "og:title", content: "Wallet — Velvato" },
      { property: "og:description", content: "Balance, recharges and income in one place." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { data: profile } = useProfile();
  const { data: transactions } = useTransactions();

  return (
    <MobileShell>
      <Header title="Wallet" />
      <div className="space-y-3 p-3">
        <WalletCard
          balance={Number(profile?.balance ?? 0)}
          badge={
            <>
              <WalletIcon className="size-4" /> Main wallet
            </>
          }
        />
        <div className="grid grid-cols-3 gap-3">
          <StatisticCard value={INR(Number(profile?.total_recharge ?? 0))} label="Recharge" />
          <StatisticCard value={INR(Number(profile?.total_income ?? 0))} label="Income" />
          <StatisticCard value={INR(Number(profile?.fixed_income ?? 0))} label="Fixed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/recharge">
            <Button size="block">
              <ArrowDownToLine className="size-5" /> Deposit
            </Button>
          </Link>
          <Link to="/withdraw">
            <Button variant="secondary" size="block">
              <ArrowUpFromLine className="size-5" /> Withdraw
            </Button>
          </Link>
        </div>
        <Card className="p-4">
          <SectionTitle className="mb-3">Latest activity</SectionTitle>
          {(transactions ?? []).length === 0 ? (
            <EmptyState title="No activity yet" description="Your wallet history appears here." />
          ) : (
            <ul className="space-y-3">
              {(transactions ?? []).slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span>
                    <span className="block font-semibold text-foreground">{t.note}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtDate(t.created_at)}
                    </span>
                  </span>
                  <span className="font-bold text-primary-dark">{INR(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </MobileShell>
  );
}
