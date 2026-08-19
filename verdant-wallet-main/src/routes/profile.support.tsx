import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Send, Mail } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { ListRow } from "@/components/ui-kit/ListRow";

export const Route = createFileRoute("/profile/support")({
  head: () => ({
    meta: [
      { title: "Customer support — Velvato" },
      { name: "description", content: "Reach Velvato support 24/7 by chat, Telegram or email." },
      { property: "og:title", content: "Customer support — Velvato" },
      { property: "og:description", content: "We reply within minutes, any time of day." },
    ],
  }),
  component: SupportPage,
});

const SUPPORT_AGENT_URL = "https://t.me/andry0725";

function SupportPage() {
  return (
    <MobileShell>
      <Header title="Online Support" />
      <div className="space-y-3 p-3">
        <Card className="overflow-hidden">
          <ListRow
            icon={<MessageCircle className="size-6" />}
            title="Live chat"
            description="Chat with our support assistant"
            to="/chat"
          />
          <ListRow
            icon={<Send className="size-6" />}
            title="Support agent"
            description="@andry0725"
            onClick={() => window.location.assign(SUPPORT_AGENT_URL)}
          />
          <ListRow
            icon={<Mail className="size-6" />}
            title="Email"
            description="support@velvato.app"
            onClick={() => {
              window.location.href = "mailto:support@velvato.app";
            }}
          />
        </Card>
      </div>
    </MobileShell>
  );
}
