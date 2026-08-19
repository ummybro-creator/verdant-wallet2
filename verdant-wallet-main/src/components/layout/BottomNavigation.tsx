import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Bike, Share2, Users, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Bike },
  { to: "/share", label: "Share", icon: Share2 },
  { to: "/team", label: "Team", icon: Users },
  { to: "/profile", label: "My", icon: CircleUser },
] as const;

export function BottomNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] border-t border-border bg-card/95 backdrop-blur-none pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-nav)]">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to}>
              <Link 
                to={to} 
                className="relative flex flex-col items-center gap-0.5 py-2"
                onClick={() => {
                  if (to === "/home") {
                    window.dispatchEvent(new Event("open-welcome-modal"));
                  }
                }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-x-6 inset-y-1 rounded-2xl bg-primary-soft"
                  />
                )}
                <Icon
                  className={cn(
                    "relative size-5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground/60",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "relative text-[11px] font-bold transition-colors",
                    active ? "text-primary" : "text-muted-foreground/70",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
