import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/not-found")({
  head: () => ({
    meta: [
      { title: "Page not found — Velvato" },
      { name: "description", content: "The page you are looking for does not exist." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Page not found — Velvato" },
      { property: "og:description", content: "This page does not exist on Velvato." },
    ],
  }),
  component: () => (
    <MobileShell nav={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-8 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Compass className="size-12" />
        </span>
        <h1 className="text-4xl font-extrabold text-foreground">404</h1>
        <p className="text-[13px] text-muted-foreground">
          We couldn't find the page you were looking for.
        </p>
        <Link to="/home">
          <Button size="lg">Back to home</Button>
        </Link>
      </div>
    </MobileShell>
  ),
});
