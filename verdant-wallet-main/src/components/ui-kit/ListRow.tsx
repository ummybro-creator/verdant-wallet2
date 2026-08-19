import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function ListRow({
  icon,
  title,
  description,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-dark">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold text-foreground">{title}</span>
        {description && (
          <span className="block truncate text-sm text-muted-foreground">{description}</span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block border-b border-border/70 last:border-0 active:bg-muted">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full border-b border-border/70 text-left last:border-0 active:bg-muted"
    >
      {inner}
    </button>
  );
}
