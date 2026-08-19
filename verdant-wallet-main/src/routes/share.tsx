import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card } from "@/components/ui-kit/Card";
import { CopyButton } from "@/components/ui-kit/CopyButton";
import { Button } from "@/components/ui-kit/Button";
import { useProfile, useSettings } from "@/services/api";
import { bannerSlides } from "@/assets";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Share & earn — Velvato referral program" },
      {
        name: "description",
        content: "Share your referral link and earn 10%, 3% and 1% across three levels.",
      },
      { property: "og:title", content: "Share & earn — Velvato" },
      {
        property: "og:description",
        content: "Three-level referral commissions on every recharge.",
      },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const inviteCode = profile?.invite_code ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/auth/register?ref=${inviteCode}`;

  const levels = [
    { level: "Level 1", rate: settings?.level1_rate ?? 0 },
    { level: "Level 2", rate: settings?.level2_rate ?? 0 },
    { level: "Level 3", rate: settings?.level3_rate ?? 0 },
  ];

  return (
    <MobileShell>
      <header className="bg-primary px-4 py-5">
        <h1 className="text-center text-xl font-extrabold text-primary-foreground">Share</h1>
      </header>
      <img
        src={bannerSlides[0]!.src}
        alt="Velvato referral promotional banner"
        loading="lazy"
        width={1200}
        height={640}
        className="aspect-[16/9] w-full object-cover"
      />

      <div className="-mt-8 space-y-4 rounded-t-[32px] bg-card px-4 pb-6 pt-6">
        <div className="flex items-center gap-3 rounded-3xl bg-primary-soft/70 p-4">
          <p className="min-w-0 flex-1 break-all text-[13px] font-medium text-foreground">{link}</p>
          <CopyButton value={link} />
        </div>
        <div className="flex items-center gap-3 rounded-3xl bg-primary-soft/70 p-4">
          <p className="flex-1 text-xl font-extrabold text-foreground">{inviteCode || "—"}</p>
          <CopyButton value={inviteCode} />
        </div>

        <div className="pt-2 text-center">
          <h2 className="text-xl font-extrabold text-foreground">Invite Commission</h2>
          <span className="mx-auto mt-2 block h-1 w-24 rounded-full bg-primary" />
        </div>

        <div className="space-y-3">
          {levels.map((c, i) => (
            <Card
              key={c.level}
              delay={i * 0.05}
              className="flex items-center justify-between rounded-2xl border-l-4 border-primary bg-primary-soft/60 px-5 py-4 shadow-none"
            >
              <span className="text-lg font-bold text-foreground">{c.level}</span>
              <span className="text-xl font-extrabold text-primary-dark">{c.rate}%</span>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank")}
          >
            <MessageCircle className="size-5" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}`, "_blank")
            }
          >
            <Send className="size-5" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={async () => {
              if (navigator.share) await navigator.share({ url: link, title: "Join Velvato" });
              else toast.success("Link ready to share");
            }}
          >
            <Share2 className="size-5" />
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
