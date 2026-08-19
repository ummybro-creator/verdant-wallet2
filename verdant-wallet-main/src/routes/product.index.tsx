import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { ProductCard } from "@/components/ui-kit/ProductCard";
import { CardSkeleton } from "@/components/ui-kit/Skeleton";
import { usePlans } from "@/services/api";

export const Route = createFileRoute("/product/")({
  head: () => ({
    meta: [
      { title: "All plans — Velvato" },
      { name: "description", content: "Every daily income and VIP plan available on Velvato." },
      { property: "og:title", content: "All plans — Velvato" },
      { property: "og:description", content: "Compare daily income and VIP investment plans." },
    ],
  }),
  component: AllPlans,
});

function AllPlans() {
  const { data: plans, isLoading } = usePlans();
  return (
    <MobileShell>
      <Header title="All Plans" />
      <div className="space-y-3 p-3">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          (plans ?? []).map((p, i) => <ProductCard key={p.id} plan={p} delay={i * 0.04} />)
        )}
      </div>
    </MobileShell>
  );
}
