import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { Input } from "@/components/ui-kit/Input";
import { PrimaryButton } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/profile/bank")({
  head: () => ({
    meta: [
      { title: "Bank account — Velvato payouts" },
      { name: "description", content: "Link the bank account that receives your withdrawals." },
      { property: "og:title", content: "Bank account — Velvato" },
      { property: "og:description", content: "Add or update your payout bank account." },
    ],
  }),
  component: () => (
    <MobileShell>
      <Header title="Bank Account" />
      <form
        className="space-y-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Bank account saved");
        }}
      >
        <Card className="space-y-3 p-4">
          <SectionTitle>Payout account</SectionTitle>
          <Input placeholder="Account holder name" />
          <Input placeholder="Account number" inputMode="numeric" />
          <Input placeholder="Re-enter account number" inputMode="numeric" />
          <Input placeholder="IFSC code" />
          <Input placeholder="Bank name" />
        </Card>
        <PrimaryButton type="submit">Save bank account</PrimaryButton>
      </form>
    </MobileShell>
  ),
});
