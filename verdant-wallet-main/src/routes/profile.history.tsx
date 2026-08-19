import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState, Loading } from "@/components/ui-kit/Skeleton";
import { usePurchases } from "@/services/api";
import { INR } from "@/utils/format";

export const Route = createFileRoute("/profile/history")({
  head: () => ({
    meta: [
      { title: "My collections — Velvato plans" },
      { name: "description", content: "Your purchased plans, subscriptions and their status." },
      { property: "og:title", content: "My collections — Velvato" },
      { property: "og:description", content: "All plans you have collected so far." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data, isLoading } = usePurchases();
  return (
    <MobileShell>
      <Header title="My Collections" />
      <div className="space-y-3 p-4">
        {isLoading && <Loading />}
        {!isLoading && !data?.length && <EmptyState title="No collections yet" />}
        {data?.map((p, i) => (
          <Card key={p.id} delay={i * 0.04} className="flex items-center justify-between p-5">
            <span>
              <span className="block text-[17px] font-bold text-foreground">
                {p.plans?.name ?? "Plan"}
              </span>
              <span className="block text-sm text-muted-foreground">
                {INR(p.daily)} daily · {p.days} days
              </span>
            </span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
              {p.status}
            </span>
          </Card>
        ))}
      </div>
    </MobileShell>
  );
}
