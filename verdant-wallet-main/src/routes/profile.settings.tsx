import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Globe, Bell, Shield, Info, FileText } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { ListRow } from "@/components/ui-kit/ListRow";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/profile/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Velvato preferences" },
      { name: "description", content: "Theme, language, notifications and privacy preferences." },
      { property: "og:title", content: "Settings — Velvato" },
      { property: "og:description", content: "Personalise your Velvato experience." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [dark, setDark] = useState(false);
  const [alerts, setAlerts] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <MobileShell>
      <Header title="Settings" />
      <div className="space-y-3 p-3">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-dark">
              <Moon className="size-6" />
            </span>
            <span className="flex-1 text-[17px] font-bold text-foreground">Dark mode</span>
            <Switch checked={dark} onCheckedChange={setDark} />
          </div>
          <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-dark">
              <Bell className="size-6" />
            </span>
            <span className="flex-1 text-[17px] font-bold text-foreground">Push notifications</span>
            <Switch checked={alerts} onCheckedChange={setAlerts} />
          </div>
          <ListRow
            icon={<Globe className="size-6" />}
            title="Language"
            description="English (India)"
            onClick={() => {}}
          />
          <ListRow
            icon={<Shield className="size-6" />}
            title="Security"
            description="Password & withdrawal PIN"
            to="/profile/security"
          />
          <ListRow icon={<FileText className="size-6" />} title="Privacy policy" to="/profile/privacy" />
          <ListRow icon={<FileText className="size-6" />} title="Terms of service" to="/profile/terms" />
          <ListRow icon={<Info className="size-6" />} title="About" description="Version 2.4.1" to="/profile/about" />
        </Card>
        <p className="pt-2 text-center text-sm text-muted-foreground">
          Velvato v2.4.1 ·{" "}
          <Link to="/profile/logout" className="font-bold text-primary-dark">
            Logout
          </Link>
        </p>
      </div>
    </MobileShell>
  );
}
