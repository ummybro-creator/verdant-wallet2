import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Timer } from "lucide-react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown({ target }: { target: number }) {
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5">
      <Timer className="size-4 text-primary-dark" />
      <div className="flex items-center gap-1 font-mono text-sm font-bold text-primary-dark">
        {[pad(h), pad(m), pad(s)].map((part, i) => (
          <motion.span key={`${i}-${part}`} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}>
            {part}
            {i < 2 ? ":" : ""}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
