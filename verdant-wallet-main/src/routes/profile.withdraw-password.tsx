import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { PasswordInput } from "@/components/ui-kit/Input";
import { PrimaryButton } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/profile/withdraw-password")({
  head: () => ({
    meta: [
      { title: "Withdrawal password — Velvato" },
      { name: "description", content: "Set or change the password required for withdrawals." },
      { property: "og:title", content: "Withdrawal password — Velvato" },
      { property: "og:description", content: "Protect every payout with a separate password." },
    ],
  }),
  component: () => (
    <MobileShell>
      <Header title="Withdrawal Password" />
      <form
        className="space-y-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Withdrawal password updated");
        }}
      >
        <Card className="space-y-3 p-4">
          <SectionTitle>Change withdrawal password</SectionTitle>
          <PasswordInput placeholder="Current withdrawal password" />
          <PasswordInput placeholder="New withdrawal password" />
          <PasswordInput placeholder="Confirm new password" />
        </Card>
        <PrimaryButton type="submit">Update password</PrimaryButton>
      </form>
    </MobileShell>
  ),
});
