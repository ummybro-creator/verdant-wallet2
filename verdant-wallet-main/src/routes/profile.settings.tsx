import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Globe, Bell, Shield, Info, FileText } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { ListRow } from "@/components/ui-kit/ListRow";
import { Switch } from "@/components/ui/switch";

import { useProfile } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const { data: profile } = useProfile();
  const [dark, setDark] = useState(false);
  const [alerts, setAlerts] = useState(true);
  
  const [pixelId, setPixelId] = useState("");
  const [savingPixel, setSavingPixel] = useState(false);

  useEffect(() => {
    if (profile?.meta_pixel_id) {
      setPixelId(profile.meta_pixel_id);
    }
  }, [profile?.meta_pixel_id]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const savePixel = async () => {
    if (!profile) return;
    setSavingPixel(true);
    const { error } = await supabase
      .from("profiles")
      .update({ meta_pixel_id: pixelId.trim() || null })
      .eq("id", profile.id);
    setSavingPixel(false);
    
    if (error) {
      toast.error("Failed to save Meta Pixel ID");
    } else {
      toast.success("Meta Pixel ID saved!");
    }
  };

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

        <Card className="overflow-hidden p-5 space-y-3">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-dark shrink-0">
              <Globe className="size-6" />
            </span>
            <div className="flex-1">
              <span className="block text-[17px] font-bold text-foreground">Meta Pixel Tracking</span>
              <span className="block text-sm text-muted-foreground">For promoters (optional)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="e.g. 1076043171806461"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={savePixel}
              disabled={savingPixel}
              className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {savingPixel ? "Saving" : "Save"}
            </button>
          </div>
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
