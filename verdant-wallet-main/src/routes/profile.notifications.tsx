import { createFileRoute } from "@tanstack/react-router";
import { BellOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { EmptyState, Loading } from "@/components/ui-kit/Skeleton";
import { Button } from "@/components/ui-kit/Button";
import { useNotifications, useSession, fmtDate } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Velvato" },
      {
        name: "description",
        content: "Income credits, payout updates and platform announcements.",
      },
      { property: "og:title", content: "Notifications — Velvato" },
      { property: "og:description", content: "Stay updated on credits and payouts." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const { userId } = useSession();
  const qc = useQueryClient();
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <MobileShell>
      <Header
        title="Notifications"
        action={
          unread > 0 ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-destructive text-xs font-extrabold text-destructive-foreground">
              {unread}
            </span>
          ) : null
        }
      />
      <div className="space-y-3 p-4">
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto flex" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
        {isLoading && <Loading />}
        {!isLoading && !notifications?.length ? (
          <EmptyState icon={<BellOff className="size-16" />} title="No notifications" />
        ) : (
          notifications?.map((n, i) => (
            <Card key={n.id} delay={i * 0.05} className="flex gap-3 p-5">
              <span
                className={
                  n.read
                    ? "mt-2 size-2 rounded-full bg-border"
                    : "mt-2 size-2 rounded-full bg-primary"
                }
              />
              <span className="flex-1">
                <span className="block text-[17px] font-bold text-foreground">{n.title}</span>
                <span className="mt-1 block text-[13px] text-muted-foreground">{n.body}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {fmtDate(n.created_at)}
                </span>
              </span>
            </Card>
          ))
        )}
      </div>
    </MobileShell>
  );
}
