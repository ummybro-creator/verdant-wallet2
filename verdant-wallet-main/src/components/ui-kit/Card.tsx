import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  interactive,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      {...(interactive ? { whileHover: { y: -3 } } : {})}
      className={cn("rounded-3xl bg-card shadow-card", className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-[15px] font-extrabold text-foreground", className)}>{children}</h2>
  );
}
