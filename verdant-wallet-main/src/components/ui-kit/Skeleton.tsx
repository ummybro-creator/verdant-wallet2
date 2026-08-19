import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-3xl bg-card p-4 shadow-card">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="aspect-[16/9] w-full" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <span className="size-8 animate-spin rounded-full border-[3px] border-primary-soft border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      {icon && <div className="text-muted-foreground/40">{icon}</div>}
      <p className="text-lg font-semibold text-muted-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
