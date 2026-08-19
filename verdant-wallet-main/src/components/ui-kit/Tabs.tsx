import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  value,
  onChange,
  layoutId = "tab-indicator",
  className,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid", className)} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className="relative pb-2.5 pt-2 text-center"
          >
            <span
              className={cn(
                "whitespace-nowrap text-[14px] font-bold transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab.label}
            </span>
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-x-1/2 bottom-0 h-1 w-16 -translate-x-1/2 rounded-full bg-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
