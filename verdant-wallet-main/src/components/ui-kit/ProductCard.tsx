import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Card } from "./Card";
import { Button } from "./Button";
import { INR } from "@/utils/format";
import { planImage, type Plan } from "@/services/api";
import { trackMetaSubscribe } from "@/lib/meta-pixel";

export function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-primary-soft/70 px-1.5 py-2 text-center">
      <p className="text-[13px] font-extrabold text-primary-dark">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProductCard({ plan, delay = 0 }: { plan: Plan; delay?: number }) {
  return (
    <Card interactive delay={delay} className="p-4">
      <h3 className="text-center text-base font-extrabold text-primary">{plan.name}</h3>
      <Link to="/product/$id" params={{ id: plan.id }} className="mt-3 block">
        <motion.img
          whileTap={{ scale: 0.98 }}
          src={planImage(plan.image)}
          alt={`${plan.name} plan banner`}
          loading="lazy"
          decoding="async"
          width={640}
          height={360}
          className="aspect-[16/9] w-full rounded-2xl object-cover"
        />
      </Link>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <StatBox value={INR(plan.price)} label="Price" />
        <StatBox value={INR(plan.daily)} label="Daily" />
        <StatBox value={String(plan.days)} label="Days" />
        <StatBox value={INR(plan.total)} label="Total" />
      </div>
      <Link to="/product/$id" params={{ id: plan.id }} className="mt-3 block">
        <Button
          size="md"
          className="w-full"
          onClick={() => {
            trackMetaSubscribe({ plan: plan.name, price: plan.price });
          }}
        >
          Buy now ({INR(plan.price)})
        </Button>
      </Link>
    </Card>
  );
}
