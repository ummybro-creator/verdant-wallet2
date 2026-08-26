import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IndianRupee, Wallet, Headphones, Send } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card } from "@/components/ui-kit/Card";
import { ProductCard } from "@/components/ui-kit/ProductCard";
import { Countdown } from "@/components/ui-kit/Countdown";
import { Tabs } from "@/components/ui-kit/Tabs";
import { CardSkeleton } from "@/components/ui-kit/Skeleton";
import { usePlans } from "@/services/api";
import { bannerSlides } from "@/assets";
import { cn } from "@/lib/utils";
import { HomeWelcomeModal } from "@/components/ui-kit/HomeWelcomeModal";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Velvato income plans" },
      {
        name: "description",
        content: "Browse daily income and VIP plans, recharge your wallet and track earnings.",
      },
      { property: "og:title", content: "Home — Velvato income plans" },
      { property: "og:description", content: "Daily income and VIP plans in one premium wallet." },
    ],
  }),
  component: HomePage,
});

const shortcuts = [
  { icon: IndianRupee, label: "Recharge", to: "/recharge" },
  { icon: Wallet, label: "Withdraw", to: "/withdraw" },
  { icon: Headphones, label: "Online", to: "/profile/support" },
  { icon: Send, label: "Channel", href: "https://t.me/+Gbku0_QTm7EwYzU1" },
] as const;

function BannerSlider() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % bannerSlides.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      <AnimatePresence mode="wait">
        <motion.img
          key={index}
          src={bannerSlides[index]!.src}
          alt={bannerSlides[index]!.alt}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          width={1200}
          height={675}
          // First slide is the LCP element — highest priority.
          // Subsequent slides are below-fold at load time — defer to save bandwidth.
          fetchPriority={index === 0 ? "high" : "low"}
          decoding={index === 0 ? "sync" : "async"}
          transition={{ duration: 0.45 }}
          className="aspect-[16/9] w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {bannerSlides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full bg-card/70 transition-all",
              i === index ? "w-5 bg-card" : "w-1.5",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function HomePage() {
  const [tab, setTab] = useState("daily");
  const { data: plans, isLoading } = usePlans();
  const list = (plans ?? []).filter((p) => p.kind === tab);

  return (
    <MobileShell>
      <div className="space-y-3 p-3">
        <BannerSlider />

        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-[13px] font-bold text-foreground">Limited-time offer ends in</span>
          <Countdown target={Date.now() + 1000 * 60 * 60 * 8} />
        </Card>

        <Card className="grid grid-cols-4 gap-1 px-2 py-4">
          {shortcuts.map(({ icon: Icon, label, ...shortcut }) => {
            const className = "flex flex-col items-center gap-1.5";
            const content = (
              <>
                <Icon className="size-6 text-primary" strokeWidth={1.8} />
                <span className="text-xs font-bold text-primary-dark">{label}</span>
              </>
            );

            return "to" in shortcut ? (
              <Link key={label} to={shortcut.to} className={className}>
                {content}
              </Link>
            ) : (
              <a
                key={label}
                href={shortcut.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          })}
        </Card>

        <Card className="px-3 pt-1">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "daily", label: "Daily Income Plan" },
              { value: "vip", label: "VIP-Plan" },
            ]}
          />
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {list.map((plan, i) => (
                <ProductCard key={plan.id} plan={plan} delay={i * 0.05} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <HomeWelcomeModal />
    </MobileShell>
  );
}
