import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Users, UsersRound } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { CopyButton } from "@/components/ui-kit/CopyButton";
import { EmptyState } from "@/components/ui-kit/Skeleton";
import { useProfile, useTeam, useSettings, fmtDate } from "@/services/api";
import { INR } from "@/utils/format";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "My Team — Velvato referrals" },
      { name: "description", content: "Track team size, team recharge and level commissions." },
      { property: "og:title", content: "My Team — Velvato" },
      { property: "og:description", content: "Grow your team and earn up to 10% commission." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: profile } = useProfile();
  const { data: team } = useTeam();
  const { data: settings } = useSettings();

  const inviteCode = profile?.invite_code ?? "—";
  const levels = [
    { level: "Level 1", rate: settings?.level1_rate ?? 0, members: team?.size ?? 0, recharge: team?.recharge ?? 0 },
    { level: "Level 2", rate: settings?.level2_rate ?? 0, members: 0, recharge: 0 },
    { level: "Level 3", rate: settings?.level3_rate ?? 0, members: 0, recharge: 0 },
  ];

  return (
    <MobileShell>
      <header className="gradient-header px-4 pb-24 pt-[calc(env(safe-area-inset-top)+18px)]">
        <h1 className="text-center text-xl font-extrabold text-primary-foreground">My Team</h1>
      </header>

      <div className="-mt-20 space-y-4 px-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Team Recharge
            </p>
            <p className="mt-2 text-xl font-extrabold text-foreground">{INR(team?.recharge ?? 0)}</p>
          </div>
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Team Size
            </p>
            <p className="mt-2 text-xl font-extrabold text-foreground">{team?.size ?? 0}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-card">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <UserPlus className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Your invite code
            </span>
            <span className="block text-xl font-extrabold text-foreground">{inviteCode}</span>
          </span>
          <CopyButton value={inviteCode} withIcon />
        </div>

        {levels.map((c) => (
          <div
            key={c.level}
            className="flex items-center gap-4 rounded-3xl gradient-primary p-5 shadow-cta"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/20 text-primary-foreground">
              <Users className="size-6" />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-extrabold text-primary-foreground">
                {c.level} Team
              </span>
              <span className="block text-sm font-medium text-primary-foreground/85">
                {c.rate}% commission · {c.members} members
              </span>
            </span>
            <span className="text-right text-primary-foreground">
              <span className="block text-[11px] font-bold uppercase tracking-wider opacity-85">
                Recharge
              </span>
              <span className="block text-xl font-extrabold">{INR(c.recharge)}</span>
            </span>
          </div>
        ))}

        {team?.members?.length ? (
          <div className="overflow-hidden rounded-3xl bg-card shadow-card">
            {team.members.map((m, i) => (
              <div
                key={`${m.phone}-${i}`}
                className="flex items-center justify-between border-b border-border/70 px-5 py-3 last:border-0"
              >
                <span>
                  <span className="block font-bold text-foreground">{m.phone}</span>
                  <span className="block text-xs text-muted-foreground">{fmtDate(m.joined)}</span>
                </span>
                <span className="font-bold text-primary-dark">{INR(m.recharge)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<UsersRound className="size-20" />}
            title="No team members yet"
            description="Share your invite code to start earning commissions."
          />
        )}
      </div>
    </MobileShell>
  );
}
