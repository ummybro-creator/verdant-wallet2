import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { StatBox } from "@/components/ui-kit/ProductCard";
import { PrimaryButton } from "@/components/ui-kit/Button";
import { Loading } from "@/components/ui-kit/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { planImage, type Plan } from "@/services/api";
import { INR } from "@/utils/format";
import { trackMetaEvent } from "@/lib/meta-pixel";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Plan details — Velvato" },
      { name: "description", content: "Investment, daily income, duration and total return." },
      { property: "og:title", content: "Plan details — Velvato" },
      { property: "og:description", content: "Review the plan before you purchase." },
    ],
  }),
  errorComponent: ({ error }) => (
    <MobileShell nav={false}>
      <Header title="Error" />
      <p role="alert" className="p-6 text-center text-muted-foreground">
        {error.message}
      </p>
    </MobileShell>
  ),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = useParams({ from: "/product/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as Plan | null;
    },
  });

  useEffect(() => {
    if (!plan) return;
    trackMetaEvent("ViewContent", {
      content_category: "income_plan",
      content_ids: plan.id,
      content_name: plan.name,
      content_type: "product",
      currency: "INR",
      value: plan.price,
    });
  }, [plan]);

  const buy = async () => {
    setBuying(true);
    const { error } = await supabase.rpc("buy_plan", { _plan_id: id });
    setBuying(false);
    if (error) {
      toast.error(error.message.replace(/^.*Insufficient balance.*$/, "Insufficient balance"));
      return;
    }
    await qc.invalidateQueries();
    trackMetaEvent("Purchase", {
      content_category: "income_plan",
      content_ids: plan?.id,
      content_name: plan?.name,
      content_type: "product",
      currency: "INR",
      value: plan?.price,
    });
    toast.success("Plan purchased successfully");
    navigate({ to: "/records" });
  };

  if (isLoading) {
    return (
      <MobileShell>
        <Header title="Plan" />
        <Loading />
      </MobileShell>
    );
  }

  if (!plan) {
    return (
      <MobileShell nav={false}>
        <Header title="Plan not found" />
        <p className="p-6 text-center text-muted-foreground">This plan is no longer available.</p>
      </MobileShell>
    );
  }

  const roi = Math.round(((plan.total - plan.price) / plan.price) * 100);

  return (
    <MobileShell>
      <Header title={plan.name} />
      <div className="space-y-3 p-3">
        <Card className="overflow-hidden">
          <img
            src={planImage(plan.image)}
            alt={`${plan.name} banner`}
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-4 gap-2">
              <StatBox value={INR(plan.price)} label="Investment" />
              <StatBox value={INR(plan.daily)} label="Daily" />
              <StatBox value={String(plan.days)} label="Days" />
              <StatBox value={`${roi}%`} label="ROI" />
            </div>
            <PrimaryButton loading={buying} onClick={buy}>
              Purchase for {INR(plan.price)}
            </PrimaryButton>
          </div>
        </Card>

        <Card className="space-y-2.5 p-4">
          <SectionTitle>Benefits</SectionTitle>
          <ul className="space-y-2 text-[13px] text-muted-foreground">
            <li>• Daily income credited automatically at 09:00 IST</li>
            <li>• Withdrawals to your linked bank account</li>
            <li>• Team commission on level 1 purchases</li>
          </ul>
        </Card>

        <Card className="space-y-2.5 p-4">
          <SectionTitle>Rules</SectionTitle>
          <ul className="space-y-2 text-[13px] text-muted-foreground">
            <li>• Purchase amount is deducted from your wallet balance</li>
            <li>
              • Total return {INR(plan.total)} over {plan.days} days
            </li>
            <li>• Withdrawals require a verified bank account</li>
          </ul>
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-2">FAQ</SectionTitle>
          <Accordion type="single" collapsible>
            <AccordionItem value="1">
              <AccordionTrigger>When is my first income credited?</AccordionTrigger>
              <AccordionContent>
                24 hours after purchase, then every day at 09:00 IST.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger>Can I cancel a plan?</AccordionTrigger>
              <AccordionContent>
                Active plans run until the full duration completes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="3">
              <AccordionTrigger>Is there a withdrawal fee?</AccordionTrigger>
              <AccordionContent>A tax applies to each withdrawal request.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>
    </MobileShell>
  );
}
