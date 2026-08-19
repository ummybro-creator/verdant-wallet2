import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { Input } from "@/components/ui-kit/Input";
import { PrimaryButton } from "@/components/ui-kit/Button";
import { useProfile } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile/account")({
  head: () => ({
    meta: [
      { title: "Account information — Velvato" },
      { name: "description", content: "Update your personal, bank and UPI details." },
      { property: "og:title", content: "Account information — Velvato" },
      { property: "og:description", content: "Keep your payout details up to date." },
    ],
  }),
  component: AccountPage,
});

const fields = ["full_name", "email", "bank_name", "account_number", "ifsc", "upi_id"] as const;
type Field = (typeof fields)[number];

function AccountPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<Field, string>>({
    full_name: "",
    email: "",
    bank_name: "",
    account_number: "",
    ifsc: "",
    upi_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      bank_name: profile.bank_name ?? "",
      account_number: profile.account_number ?? "",
      ifsc: profile.ifsc ?? "",
      upi_id: profile.upi_id ?? "",
    });
  }, [profile]);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile updated");
  };

  return (
    <MobileShell>
      <Header title="Account Information" />
      <form className="space-y-3 p-3" onSubmit={save}>
        <Card className="space-y-3 p-4">
          <SectionTitle>Personal details</SectionTitle>
          <Input value={form.full_name} onChange={set("full_name")} placeholder="Full name" />
          <Input value={profile?.phone ?? ""} placeholder="Phone" readOnly />
          <Input value={form.email} onChange={set("email")} placeholder="Email" type="email" />
          <Input value={profile?.user_code ?? ""} placeholder="UID" readOnly />
        </Card>
        <Card className="space-y-3 p-4">
          <SectionTitle>Bank & UPI</SectionTitle>
          <Input value={form.bank_name} onChange={set("bank_name")} placeholder="Bank name" />
          <Input
            value={form.account_number}
            onChange={set("account_number")}
            placeholder="Account number"
          />
          <Input value={form.ifsc} onChange={set("ifsc")} placeholder="IFSC code" />
          <Input value={form.upi_id} onChange={set("upi_id")} placeholder="UPI ID" />
        </Card>
        <PrimaryButton type="submit" loading={saving}>
          Save changes
        </PrimaryButton>
      </form>
    </MobileShell>
  );
}
