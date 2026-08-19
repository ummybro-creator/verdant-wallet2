import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, CalendarClock, LayoutDashboard, ShieldAlert, UsersRound } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { Tabs } from "@/components/ui-kit/Tabs";
import { Input } from "@/components/ui-kit/Input";
import { Button, PrimaryButton } from "@/components/ui-kit/Button";
import { EmptyState, Loading } from "@/components/ui-kit/Skeleton";
import { useIsAdmin, useSession, fmtDate } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { INR } from "@/utils/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Velvato control centre" },
      { name: "description", content: "Manage users, deposits, withdrawals and app settings." },
      { property: "og:title", content: "Admin panel — Velvato" },
      { property: "og:description", content: "Internal control centre for Velvato operators." },
    ],
  }),
  component: AdminPage,
});

type Stats = {
  users: number;
  users_today: number;
  balance: number;
  deposits_total: number;
  deposits_pending: number;
  withdrawals_total: number;
  withdrawals_pending: number;
  purchases: number;
  invested: number;
  payment_requests_pending: number;
};

const tabs = [
  { value: "dashboard", label: "Stats" },
  { value: "activity", label: "Activity" },
  { value: "deposits", label: "Deposits" },
  { value: "requests", label: "Requests" },
  { value: "withdrawals", label: "Payouts" },
  { value: "users", label: "Users" },
  { value: "settings", label: "Settings" },
];

function AdminPage() {
  const { ready, session } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/auth/login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || isLoading) {
    return (
      <MobileShell nav={false} guard={false}>
        <Loading label="Checking access..." />
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell nav={false} guard={false}>
        <Header title="Admin" />
        <EmptyState
          icon={<ShieldAlert className="size-16" />}
          title="Access denied"
          description="This area is restricted to administrators."
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell nav={false} guard={false} className="pb-10">
      <Header title="Admin Panel" />
      <div className="sticky top-[64px] z-20 border-b border-border bg-card">
        <Tabs tabs={tabs} value={tab} onChange={setTab} layoutId="admin-tab" />
      </div>
      <div className="space-y-3 p-3">
        {tab === "dashboard" && <Dashboard />}
        {tab === "activity" && <ActivityLog />}
        {tab === "deposits" && <Deposits />}
        {tab === "requests" && <PaymentRequests />}
        {tab === "withdrawals" && <Withdrawals />}
        {tab === "users" && <Users />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </MobileShell>
  );
}

type ActivityProfile = {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  user_code: string;
  vip: string;
  balance: number;
  total_recharge: number;
  blocked: boolean;
  created_at: string;
};

type ActivityPayment = {
  id: string;
  user_id: string;
  amount: number;
  upi_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

type ActivityRow = ActivityProfile & {
  paymentVisits: ActivityPayment[];
};

const activityDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ActivityLog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async (): Promise<ActivityRow[]> => {
      // Keep this frontend-only: read the existing admin-visible tables and
      // join them in memory instead of changing the database or RPC layer.
      const [profilesResult, paymentsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, phone, email, full_name, user_code, vip, balance, total_recharge, blocked, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("payment_requests")
          .select("id, user_id, amount, upi_id, status, expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const paymentsByUser = new Map<string, ActivityPayment[]>();
      for (const payment of (paymentsResult.data ?? []) as ActivityPayment[]) {
        const visits = paymentsByUser.get(payment.user_id) ?? [];
        visits.push(payment);
        paymentsByUser.set(payment.user_id, visits);
      }

      return ((profilesResult.data ?? []) as ActivityProfile[]).map((profile) => ({
        ...profile,
        paymentVisits: paymentsByUser.get(profile.id) ?? [],
      }));
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <Loading label="Loading user activity..." />;
  if (error) {
    return (
      <EmptyState
        title="Could not load activity"
        description={(error as Error).message}
      />
    );
  }

  const rows = data ?? [];
  const visitors = rows.filter((row) => row.paymentVisits.length > 0).length;
  const sessions = rows.reduce((total, row) => total + row.paymentVisits.length, 0);

  if (!rows.length) return <EmptyState title="No registered users yet" />;

  return (
    <>
      <SectionTitle className="flex items-center gap-2">
        <Activity className="size-5 text-primary" /> User activity
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <UsersRound className="size-4 text-primary" />
          <p className="mt-2 text-lg font-extrabold text-foreground">{rows.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Registered
          </p>
        </Card>
        <Card className="p-3">
          <Activity className="size-4 text-primary" />
          <p className="mt-2 text-lg font-extrabold text-foreground">{visitors}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Payment visitors
          </p>
        </Card>
        <Card className="p-3">
          <CalendarClock className="size-4 text-primary" />
          <p className="mt-2 text-lg font-extrabold text-foreground">{sessions}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Sessions
          </p>
        </Card>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Registration time comes from the existing profile record. A payment session is created
        when a logged-in user initiates a{" "}
        <span className="font-bold text-foreground">WatchPay order</span>{" "}
        from the Recharge page.
      </p>

      {rows.map((user, i) => (
        <Card key={user.id} delay={i * 0.02} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-extrabold text-foreground">
                {user.full_name || user.phone || "Unknown user"}
              </p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">
                {user.phone} · UID {user.user_code}
              </p>
              {user.email && (
                <p className="break-all text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
            <span
              className={
                user.blocked
                  ? "rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700"
                  : "rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold text-primary-dark"
              }
            >
              {user.blocked ? "blocked" : user.vip}
            </span>
          </div>

          <div className="rounded-xl bg-muted/50 p-3 text-xs">
            <p className="font-bold text-foreground">Registered</p>
            <p className="mt-1 text-muted-foreground">{activityDate(user.created_at)}</p>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-foreground">Payment visits</p>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold text-primary-dark">
                {user.paymentVisits.length}
              </span>
            </div>

            {!user.paymentVisits.length ? (
              <p className="mt-2 text-xs text-muted-foreground">No payment orders recorded.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {user.paymentVisits.map((visit) => (
                  <div key={visit.id} className="border-t border-border pt-2 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{INR(visit.amount)}</span>
                      <span className="text-[11px] font-bold capitalize text-primary-dark">
                        {visit.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Opened: {activityDate(visit.created_at)}
                    </p>
                    <p className="break-all text-[11px] text-muted-foreground">
                      UPI: {visit.upi_id || "—"} · Expires: {activityDate(visit.expires_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Balance {INR(user.balance)}</span>
            <span>Recharge {INR(user.total_recharge)}</span>
          </div>
        </Card>
      ))}
    </>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<Stats> => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  if (isLoading) return <Loading />;
  const cards = [
    { label: "Total users", value: String(data?.users ?? 0) },
    { label: "New today", value: String(data?.users_today ?? 0) },
    { label: "Wallet balance", value: INR(data?.balance ?? 0) },
    { label: "Deposits approved", value: INR(data?.deposits_total ?? 0) },
    { label: "Deposits pending", value: String(data?.deposits_pending ?? 0) },
    { label: "Payouts paid", value: INR(data?.withdrawals_total ?? 0) },
    { label: "Payouts pending", value: String(data?.withdrawals_pending ?? 0) },
    { label: "Total invested", value: INR(data?.invested ?? 0) },
    { label: "Live payment sessions", value: String(data?.payment_requests_pending ?? 0) },
  ];

  return (
    <>
      <SectionTitle className="flex items-center gap-2">
        <LayoutDashboard className="size-5 text-primary" /> Overview
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <Card key={c.label} delay={i * 0.03} className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1.5 text-xl font-extrabold text-foreground">{c.value}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

type PaymentRequestRow = {
  id: string;
  amount: number;
  upi_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

function PaymentRequests() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-requests"],
    queryFn: async (): Promise<PaymentRequestRow[]> => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("id, amount, upi_id, status, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PaymentRequestRow[];
    },
    refetchInterval: 20_000,
  });

  if (isLoading) return <Loading />;
  if (!data?.length) return <EmptyState title="No payment requests yet" />;

  return (
    <>
      <SectionTitle>Payment sessions</SectionTitle>
      {data.map((r, i) => {
        const live = r.status === "pending" && new Date(r.expires_at).getTime() > Date.now();
        return (
          <Card key={r.id} delay={i * 0.03} className="space-y-1.5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-foreground">{INR(r.amount)}</span>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
                {live ? "live" : r.status === "pending" ? "expired" : r.status}
              </span>
            </div>
            <p className="break-all text-sm text-muted-foreground">UPI: {r.upi_id ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
          </Card>
        );
      })}
    </>
  );
}

function useAdminList<T>(key: string, table: "deposits" | "withdrawals") {
  return useQuery({
    queryKey: [key],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });
}

type Deposit = {
  id: string;
  user_id: string;
  amount: number;
  utr: string;
  status: string;
  created_at: string;
};

function Deposits() {
  const { data, isLoading } = useAdminList<Deposit>("admin-deposits", "deposits");
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_deposit", { _id: id, _approve: approve });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success(approve ? "Deposit approved" : "Deposit rejected");
  };

  if (isLoading) return <Loading />;
  if (!data?.length) return <EmptyState title="No deposits yet" />;

  return (
    <>
      {data.map((d, i) => (
        <Card key={d.id} delay={i * 0.03} className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-foreground">{INR(d.amount)}</span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
              {d.status}
            </span>
          </div>
          <p className="break-all text-sm text-muted-foreground">UTR: {d.utr}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</p>
          {d.status === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="md" loading={busy === d.id} onClick={() => review(d.id, true)}>
                Approve
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={busy === d.id}
                onClick={() => review(d.id, false)}
              >
                Reject
              </Button>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

type Withdrawal = {
  id: string;
  amount: number;
  net: number;
  tax: number;
  destination: string | null;
  status: string;
  created_at: string;
};

function Withdrawals() {
  const { data, isLoading } = useAdminList<Withdrawal>("admin-withdrawals", "withdrawals");
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_review_withdrawal", { _id: id, _approve: approve });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success(approve ? "Payout marked paid" : "Payout rejected & refunded");
  };

  if (isLoading) return <Loading />;
  if (!data?.length) return <EmptyState title="No withdrawal requests" />;

  return (
    <>
      {data.map((w, i) => (
        <Card key={w.id} delay={i * 0.03} className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-foreground">{INR(w.amount)}</span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark">
              {w.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Net {INR(w.net)} · Tax {INR(w.tax)}
          </p>
          <p className="break-all text-sm text-muted-foreground">To: {w.destination ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(w.created_at)}</p>
          {w.status === "pending" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="md" loading={busy === w.id} onClick={() => review(w.id, true)}>
                Mark paid
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={busy === w.id}
                onClick={() => review(w.id, false)}
              >
                Reject
              </Button>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

type AdminUser = {
  id: string;
  phone: string;
  user_code: string;
  vip: string;
  balance: number;
  total_recharge: number;
  blocked: boolean;
  created_at: string;
};

function Users() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, phone, user_code, vip, balance, total_recharge, blocked, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdminUser[];
    },
  });

  const adjust = async (id: string) => {
    const raw = window.prompt("Adjust balance by (use - to deduct):");
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === 0) { toast.error("Enter a valid amount"); return; }
    const { error } = await supabase.rpc("admin_adjust_balance", {
      _user_id: id,
      _amount: amount,
      _note: "Admin adjustment",
    });
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Balance updated");
  };

  const toggleBlock = async (u: AdminUser) => {
    const { error } = await supabase.from("profiles").update({ blocked: !u.blocked }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success(u.blocked ? "User unblocked" : "User blocked");
  };

  if (isLoading) return <Loading />;
  const list = (data ?? []).filter(
    (u) => u.phone.includes(search) || u.user_code.includes(search),
  );

  return (
    <>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search phone or UID"
        className="h-12"
      />
      {!list.length && <EmptyState title="No users found" />}
      {list.map((u, i) => (
        <Card key={u.id} delay={i * 0.02} className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span>
              <span className="block font-extrabold text-foreground">{u.phone}</span>
              <span className="block text-xs text-muted-foreground">
                UID {u.user_code} · {u.vip} · {fmtDate(u.created_at)}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-extrabold text-primary-dark">{INR(u.balance)}</span>
              <span className="block text-xs text-muted-foreground">
                Recharge {INR(u.total_recharge)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="md" onClick={() => adjust(u.id)}>
              Adjust balance
            </Button>
            <Button
              variant={u.blocked ? "secondary" : "danger"}
              size="md"
              onClick={() => toggleBlock(u)}
            >
              {u.blocked ? "Unblock" : "Block"}
            </Button>
          </div>
        </Card>
      ))}
    </>
  );
}

function SettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      upi_id: data.upi_id ?? "",
      payee_name: data.payee_name ?? "",
      min_recharge: String(data.min_recharge ?? ""),
      min_withdraw: String(data.min_withdraw ?? ""),
      tax_percent: String(data.tax_percent ?? ""),
      level1_rate: String(data.level1_rate ?? ""),
      level2_rate: String(data.level2_rate ?? ""),
      level3_rate: String(data.level3_rate ?? ""),
      recharge_presets: (data.recharge_presets ?? []).join(", "),
      support_url: data.support_url ?? "",
      channel_url: data.channel_url ?? "",
      apk_url: data.apk_url ?? "",
    });
  }, [data]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        upi_id: form['upi_id'] ?? "",
        payee_name: form['payee_name'] ?? "",
        min_recharge: Number(form['min_recharge']) || 0,
        min_withdraw: Number(form['min_withdraw']) || 0,
        tax_percent: Number(form['tax_percent']) || 0,
        level1_rate: Number(form['level1_rate']) || 0,
        level2_rate: Number(form['level2_rate']) || 0,
        level3_rate: Number(form['level3_rate']) || 0,
        recharge_presets: (form['recharge_presets'] ?? "")
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
        support_url: form['support_url'] ?? "",
        channel_url: form['channel_url'] ?? "",
        apk_url: form['apk_url'] ?? "",
      })
      .eq("id", true);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Settings saved");
  };

  if (isLoading) return <Loading />;

  const fields: { key: string; label: string }[] = [
    { key: "upi_id", label: "Payment UPI ID" },
    { key: "payee_name", label: "Payee name" },
    { key: "min_recharge", label: "Minimum recharge" },
    { key: "min_withdraw", label: "Minimum withdrawal" },
    { key: "tax_percent", label: "Withdrawal tax %" },
    { key: "level1_rate", label: "Level 1 commission %" },
    { key: "level2_rate", label: "Level 2 commission %" },
    { key: "level3_rate", label: "Level 3 commission %" },
    { key: "recharge_presets", label: "Recharge presets (comma separated)" },
    { key: "support_url", label: "Support URL" },
    { key: "channel_url", label: "Channel URL" },
    { key: "apk_url", label: "APK URL" },
  ];

  return (
    <Card className="space-y-3 p-4">
      <SectionTitle>System settings</SectionTitle>
      {fields.map((f) => (
        <label key={f.key} className="block space-y-1.5">
          <span className="pl-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {f.label}
          </span>
          <Input value={form[f.key] ?? ""} onChange={set(f.key)} className="h-12" />
        </label>
      ))}
      <PrimaryButton loading={saving} onClick={save}>
        Save settings
      </PrimaryButton>
    </Card>
  );
}
