import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState, Loading } from "@/components/ui-kit/Skeleton";
import { usePurchases, fmtDate } from "@/services/api";
import { INR } from "@/utils/format";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "My records — Velvato purchases" },
      { name: "description", content: "Every plan you have purchased and its earning progress." },
      { property: "og:title", content: "My records — Velvato" },
      { property: "og:description", content: "Track active plans and completed cycles." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const { data, isLoading } = usePurchases();

  return (
    <MobileShell>
      <Header title="My Records" />
      <div className="space-y-3 p-3">
        {isLoading && <Loading />}
        {!isLoading && !data?.length && (
          <EmptyState title="No purchases yet" description="Buy a plan to start earning daily." />
        )}
        {data?.map((p, i) => {
          const start = new Date(p.started_at).getTime();
          const end = new Date(p.ends_at).getTime();
          const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
          return (
            <Card key={p.id} delay={i * 0.05} className="space-y-2.5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-foreground">
                  {p.plans?.name ?? "Plan"}
                </h2>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
                  {p.status}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Invested {INR(p.amount)}</span>
                <span>Daily {INR(p.daily)}</span>
                <span>{p.days} days</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full gradient-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Started {fmtDate(p.started_at)}</p>
            </Card>
          );
        })}
      </div>
    </MobileShell>
  );
}
