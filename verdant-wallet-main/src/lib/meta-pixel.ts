// ─── Meta Pixel ────────────────────────────────────────────────────────────
// Pixel ID: 1284378021424877  (updated Aug 2026)
export const META_PIXEL_ID = "1284378021424877";

type MetaEventParams = Record<string, string | number | boolean | undefined>;

type FbqFunction = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  callMethod?: (...args: unknown[]) => void;
};

type MetaPixelWindow = Window & {
  fbq?: FbqFunction;
  _fbq?: FbqFunction;
};


let initialized = false;

export function initMetaPixel() {
  if (typeof window === "undefined" || initialized) return;

  const pixelWindow = window as MetaPixelWindow;

  if (!pixelWindow.fbq) {
    const fbq = ((...args: unknown[]) => {
      if ((fbq as unknown as { callMethod?: (...a: unknown[]) => void }).callMethod) {
        (fbq as unknown as { callMethod: (...a: unknown[]) => void }).callMethod(...args);
      } else {
        fbq.queue?.push(args);
      }
    }) as MetaPixelWindow["fbq"] & { callMethod?: (...args: unknown[]) => void };

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    pixelWindow.fbq = fbq;
    pixelWindow._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  pixelWindow.fbq?.("init", META_PIXEL_ID);
  pixelWindow.fbq?.("track", "PageView");
  initialized = true;
}

export function trackMetaEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  if (!initialized) initMetaPixel();
  (window as MetaPixelWindow).fbq?.("track", eventName, params ?? {});
}

export function trackMetaCustomEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  if (!initialized) initMetaPixel();
  (window as MetaPixelWindow).fbq?.("trackCustom", eventName, params ?? {});
}

export function trackMetaSubscribe(params?: MetaEventParams) {
  trackMetaEvent("Subscribe", params);
}