import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function Header({
  title,
  back = true,
  action,
}: {
  title: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 gradient-header px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="flex items-center justify-between gap-3">
        {back ? (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.history.back()}
            className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/20 text-primary-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span className="size-9" />
        )}
        <h1 className="text-lg font-extrabold text-primary-foreground">{title}</h1>
        <span className="flex size-9 items-center justify-center">{action}</span>
      </div>
    </header>
  );
}
