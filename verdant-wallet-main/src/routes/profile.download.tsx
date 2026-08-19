import { createFileRoute } from "@tanstack/react-router";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";
import { PrimaryButton } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/profile/download")({
  head: () => ({
    meta: [
      { title: "Download the Velvato app" },
      { name: "description", content: "Install the Velvato Android app for faster access." },
      { property: "og:title", content: "Download the Velvato app" },
      { property: "og:description", content: "Get the official Velvato APK for Android." },
    ],
  }),
  component: () => (
    <MobileShell>
      <Header title="Download Apk" />
      <div className="space-y-3 p-3">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-primary-soft text-primary">
            <Smartphone className="size-10" />
          </span>
          <SectionTitle>Velvato for Android</SectionTitle>
          <p className="text-[13px] text-muted-foreground">
            Version 2.4.1 · 18 MB · Requires Android 8.0+
          </p>
          <PrimaryButton onClick={() => toast.success("Download started")}>
            <Download className="size-5" /> Download APK
          </PrimaryButton>
        </Card>
      </div>
    </MobileShell>
  ),
});
