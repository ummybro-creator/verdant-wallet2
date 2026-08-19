import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";

const TELEGRAM_CHANNEL = "https://t.me/+Gbku0_QTm7EwYzU1";

const launchDetails = [
  ["Launch Date", "10 August 2026"],
  ["Minimum Recharge", "₹0"],
  ["Minimum Withdrawal", "₹210"],
  ["Withdrawal Time", "24x7 hours"],
  ["Team Commission", "43%"],
] as const;

export function HomeWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem("velvato-welcome-dismissed") === "1";
    setOpen(!dismissed);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.sessionStorage.setItem("velvato-welcome-dismissed", "1");
        document.body.style.overflow = "";
        setOpen(false);
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    if (!dismissed) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!open) return null;

  const dismiss = () => {
    window.sessionStorage.setItem("velvato-welcome-dismissed", "1");
    document.body.style.overflow = "";
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/25 px-3 py-4 backdrop-blur-[3px] sm:px-6 sm:py-6"
      onClick={dismiss}
      role="presentation"
    >
      <div
        aria-labelledby="welcome-modal-title"
        aria-modal="true"
        className="my-auto max-h-[calc(100dvh-32px)] w-[min(100%,390px)] overflow-y-auto overscroll-contain rounded-[22px] bg-white shadow-[0_18px_55px_-18px_rgba(20,20,35,0.38)] sm:max-h-[calc(100dvh-48px)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="relative flex min-h-[64px] items-center justify-center bg-gradient-to-br from-[#f72f8c] via-[#f22682] to-[#e91b77] px-12 py-2.5 sm:min-h-[72px]">
          <h2
            id="welcome-modal-title"
            className="max-w-[calc(100%_-_48px)] text-center text-[clamp(19px,3vw,24px)] font-normal leading-tight tracking-[-0.5px] text-white"
          >
            Welcome to <strong className="font-extrabold">Velvato</strong>
          </h2>
          <button
            aria-label="Close welcome message"
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={dismiss}
            type="button"
          >
            <X className="size-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="space-y-2.5 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {launchDetails.map(([label, value]) => (
            <div
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#fff1f8] px-3.5"
              key={label}
            >
              <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-[#171b29]">
                {label}
              </span>
              <span className="shrink-0 text-right text-sm font-extrabold leading-tight text-[#e43189]">
                {value}
              </span>
            </div>
          ))}

          <a
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#f93694] to-[#e71379] text-base font-bold text-white shadow-[0_9px_20px_-8px_rgba(231,19,121,0.72)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e71379] focus-visible:ring-offset-2"
            href={TELEGRAM_CHANNEL}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#ed2382]">
              <Send className="ml-[-2px] size-4 fill-current" strokeWidth={2.6} />
            </span>
            Official Channel
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-1 text-xs font-bold text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Continue to home
          </button>
        </div>
      </div>
    </div>
  );
}
