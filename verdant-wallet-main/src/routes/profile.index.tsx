import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LogOut,
  Zap,
  Upload,
  ChevronRight,
  IdCard,
  ClipboardList,
  ReceiptText,
  Info,
  Download,
  Bell,
  Settings,
  Crown,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { Button } from "@/components/ui-kit/Button";
import { ListRow } from "@/components/ui-kit/ListRow";
import { useProfile, useIsAdmin } from "@/services/api";
import { INR } from "@/utils/format";
import { logoSrc } from "@/assets";

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [
      { title: "My account — Velvato profile" },
      {
        name: "description",
        content: "View your balance, VIP level, collections and account settings.",
      },
      { property: "og:title", content: "My account — Velvato" },
      { property: "og:description", content: "Balance, VIP status and quick account actions." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const phone = profile?.phone ?? "";
  const uid = profile?.user_code ?? "";
  const vip = profile?.vip ?? "VIP0";
  const balance = profile?.balance ?? 0;
  const recharge = profile?.total_recharge ?? 0;
  const totalIncome = profile?.total_income ?? 0;
  const fixedIncome = profile?.fixed_income ?? 0;

  return (
    <MobileShell>
      <header className="relative overflow-hidden gradient-header px-4 pb-20 pt-[calc(env(safe-area-inset-top)+14px)]">
        <span className="pointer-events-none absolute -right-16 -top-10 size-64 rounded-full bg-primary-foreground/10" />
        <div className="relative flex items-start gap-4">
          <div className="relative">
            <img
              src={logoSrc}
              alt="Velvato logo"
              className="size-[68px] rounded-2xl border-4 border-card bg-card object-cover"
            />
            <span className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-warning px-3 py-1 text-xs font-extrabold text-foreground">
              <Crown className="size-3" /> {vip}
            </span>
          </div>
          <div className="flex-1 pt-2">
            <p className="border-b-2 border-primary-foreground/70 pb-1 text-base font-extrabold text-primary-foreground">
              {phone}
            </p>
            <p className="mt-2 text-[13px] font-medium text-primary-foreground/85">UID: {uid}</p>
          </div>
          <Link
            to="/profile/logout"
            className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/20 text-primary-foreground"
            aria-label="Logout"
          >
            <LogOut className="size-5" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 -mt-14 space-y-3 px-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Available Balance
          </p>
          <p className="mt-1 text-[30px] font-extrabold leading-none text-primary-dark">
            {INR(balance)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link to="/recharge">
              <Button size="block">
                <Zap className="size-4" /> Deposit
              </Button>
            </Link>
            <Link to="/withdraw">
              <Button variant="secondary" size="block">
                <Upload className="size-4" /> Withdraw
              </Button>
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-border text-center">
            {[
              { v: recharge, l: "Recharge" },
              { v: totalIncome, l: "Total Income" },
              { v: fixedIncome, l: "Fixed Income" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-base font-extrabold text-foreground">{INR(s.v)}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <SectionTitle className="flex items-center gap-2 pt-1">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ChevronRight className="size-4" />
          </span>
          Quick Actions
        </SectionTitle>

        <Card className="overflow-hidden">
          {isAdmin && (
            <ListRow
              icon={<Settings className="size-5" />}
              title="Admin Panel"
              description="Manage users, deposits & settings"
              to="/admin"
            />
          )}
          <ListRow
            icon={<IdCard className="size-5" />}
            title="Account Information"
            description="Bank & account details"
            to="/profile/account"
          />

          <ListRow
            icon={<ClipboardList className="size-5" />}
            title="My Collections"
            description="Your active plans & subscriptions"
            to="/profile/history"
          />
          <ListRow
            icon={<ReceiptText className="size-5" />}
            title="Transaction Details"
            description="Track your transactions history"
            to="/transactions"
          />
          <ListRow
            icon={<Bell className="size-5" />}
            title="Notifications"
            description="Alerts & announcements"
            to="/profile/notifications"
          />
          <ListRow
            icon={<Settings className="size-5" />}
            title="Settings"
            description="Preferences & security"
            to="/profile/settings"
          />
          <ListRow
            icon={<Info className="size-5" />}
            title="About Us"
            description="Company information & policies"
            to="/profile/about"
          />
          <ListRow
            icon={<Download className="size-5" />}
            title="Download Apk"
            description="Get the Android application"
            to="/profile/download"
          />
          <ListRow
            icon={<LogOut className="size-5" />}
            title="Logout"
            description="logout your id"
            to="/profile/logout"
          />
        </Card>
      </div>
    </MobileShell>
  );
}
