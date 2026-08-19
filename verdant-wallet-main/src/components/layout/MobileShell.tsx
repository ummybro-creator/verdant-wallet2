import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "./BottomNavigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export function MobileShell({
  children,
  nav = true,
  className,
  guard = true,
}: {
  children: React.ReactNode;
  nav?: boolean;
  className?: string;
  guard?: boolean;
}) {
  const { session, ready } = useAuthGuard();

  return (
    <div className="min-h-screen w-full bg-muted/60">
      <div className="relative mx-auto min-h-screen w-full max-w-[520px] bg-background shadow-[0_0_60px_-20px_oklch(0.4_0.02_250/25%)]">
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cn(nav && "pb-28", className)}
        >
          {guard && (!ready || !session) ? null : children}
        </motion.main>
        {nav && <BottomNavigation />}
      </div>
    </div>
  );
}
