import { cn } from "@/lib/utils";
import { Input } from "./Input";
import { INR } from "@/utils/format";

export function PercentageButtons({
  balance,
  onSelect,
  active,
}: {
  balance: number;
  onSelect: (amount: number) => void;
  active?: number;
}) {
  const options = [
    { label: "25%", value: Math.floor(balance * 0.25) },
    { label: "50%", value: Math.floor(balance * 0.5) },
    { label: "75%", value: Math.floor(balance * 0.75) },
    { label: "Max", value: balance },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onSelect(o.value)}
          className={cn(
            "rounded-2xl border border-border bg-card py-3 transition-colors",
            active === o.value && "border-primary bg-primary-soft",
          )}
        >
          <span className="block text-lg font-extrabold text-foreground">{o.label}</span>
          <span className="block text-xs text-muted-foreground">{INR(o.value)}</span>
        </button>
      ))}
    </div>
  );
}

export function AmountInput({
  value,
  onChange,
  currency = "INR",
  placeholder = "Enter amount",
}: {
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  placeholder?: string;
}) {
  return (
    <Input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      placeholder={placeholder}
      leading={
        <span className="flex items-center gap-3 pr-1">
          <span className="text-[17px] font-extrabold text-primary">{currency}</span>
          <span className="h-7 w-px bg-border" />
        </span>
      }
    />
  );
}
