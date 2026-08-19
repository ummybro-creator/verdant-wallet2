import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ReceiptText } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState } from "@/components/ui-kit/Skeleton";
import { useTransactions, fmtDate } from "@/services/api";
import { INR } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction history — Velvato" },
      {
        name: "description",
        content: "Filter recharges, withdrawals, income and referral commissions.",
      },
      { property: "og:title", content: "Transaction history — Velvato" },
      { property: "og:description", content: "Every recharge, payout and commission in one list." },
    ],
  }),
  component: TransactionsPage,
});

const tabs = [
  { value: "recharge", label: "Recharge" },
  { value: "withdraw", label: "Withdraw" },
  { value: "purchase", label: "Purchase" },
  { value: "income", label: "Income" },
  { value: "referral", label: "Referral" },
];

const statusStyles: Record<string, string> = {
  success: "bg-primary-soft text-primary-dark",
  approved: "bg-primary-soft text-primary-dark",
  pending: "bg-warning/20 text-warning",
  failed: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

function TransactionsPage() {
  const { data: transactions } = useTransactions();
  const [tab, setTab] = useState("recharge");
  const list = (transactions ?? []).filter((t) => t.type === tab);

  return (
    <MobileShell>
      <Header title="Transactions" />
      <div className="space-y-3 p-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
                tab === t.value
                  ? "gradient-primary text-primary-foreground shadow-cta"
                  : "bg-card text-muted-foreground shadow-card",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="space-y-3"
          >
            {list.length === 0 ? (
              <EmptyState
                icon={<ReceiptText className="size-16" />}
                title="No transactions yet"
                description="Your activity will appear here."
              />
            ) : (
              list.map((t, i) => (
                <Card key={t.id} delay={i * 0.04} className="flex items-center gap-4 p-5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold text-foreground">{t.note}</span>
                    <span className="block text-sm text-muted-foreground">
                      {fmtDate(t.created_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-extrabold text-foreground">
                      {INR(Number(t.amount))}
                    </span>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold capitalize",
                        statusStyles[t.status],
                      )}
                    >
                      {t.status}
                    </span>
                  </span>
                </Card>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </MobileShell>
  );
}
