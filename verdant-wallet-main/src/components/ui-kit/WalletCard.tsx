import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import wallet from "@/assets/wallet-3d.webp";
import { INR2 } from "@/utils/format";

export function WalletCard({
  balance,
  badge,
  label = "Available Balance",
  prefix,
}: {
  balance: number;
  badge: React.ReactNode;
  label?: string;
  prefix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl gradient-primary p-5 shadow-cta"
    >
      <p className="text-[13px] font-medium text-primary-foreground/90">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-primary-foreground">
        {prefix && <span className="text-xl font-bold">{prefix}</span>}
        <span className="text-[32px] font-extrabold leading-none">{INR2(balance)}</span>
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/20 px-3 py-1.5 text-xs font-semibold text-primary-foreground">
        {badge}
      </div>
      <img
        src={wallet}
        alt=""
        aria-hidden
        loading="lazy"
        width={700}
        height={700}
        className="pointer-events-none absolute -right-2 top-1/2 w-28 -translate-y-1/2"
      />
    </motion.div>
  );
}

export function StatisticCard({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-card p-4 shadow-card", className)}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}
