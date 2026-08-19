import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { PrimaryButton, SecondaryButton } from "@/components/ui-kit/Button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile/logout")({
  head: () => ({
    meta: [
      { title: "Logout — Velvato" },
      { name: "description", content: "Sign out of your Velvato account on this device." },
      { property: "og:title", content: "Logout — Velvato" },
      { property: "og:description", content: "End your session securely." },
    ],
  }),
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate({ to: "/auth/login", replace: true });
  };

  return (
    <MobileShell nav={false}>
      <Header title="Logout" />
      <div className="p-4">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
            <LogOut className="size-10" />
          </span>
          <SectionTitle>Log out of Velvato?</SectionTitle>
          <p className="text-[13px] text-muted-foreground">
            You will need your mobile number and password to sign back in.
          </p>
          <PrimaryButton className="bg-none bg-destructive shadow-none" onClick={signOut}>
            Yes, log me out
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate({ to: "/profile" })}>Cancel</SecondaryButton>
        </Card>
      </div>
    </MobileShell>
  );
}
