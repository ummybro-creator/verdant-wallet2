import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { PasswordInput } from "@/components/ui-kit/Input";
import { PrimaryButton } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/profile/security")({
  head: () => ({
    meta: [
      { title: "Security — change your Velvato password" },
      { name: "description", content: "Change your login password and manage account security." },
      { property: "og:title", content: "Security — Velvato" },
      { property: "og:description", content: "Keep your Velvato account protected." },
    ],
  }),
  component: () => (
    <MobileShell>
      <Header title="Security" />
      <form
        className="space-y-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Login password updated");
        }}
      >
        <Card className="space-y-3 p-4">
          <SectionTitle>Change login password</SectionTitle>
          <PasswordInput placeholder="Current password" />
          <PasswordInput placeholder="New password" />
          <PasswordInput placeholder="Confirm new password" />
        </Card>
        <PrimaryButton type="submit">Update password</PrimaryButton>
      </form>
    </MobileShell>
  ),
});
