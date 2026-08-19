export const META_PIXEL_ID = "1658175685927115";

type MetaEventParams = Record<string, string | number | boolean | undefined>;

type MetaPixelWindow = Window & {
  fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string };
  _fbq?: Window["fbq"];
};

let initialized = false;

export function initMetaPixel() {
  if (typeof window === "undefined" || initialized) return;

  const pixelWindow = window as MetaPixelWindow;
  const existingFbq = pixelWindow.fbq;

  if (!existingFbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
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
  initialized = true;
}

export function trackMetaEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  initMetaPixel();
  (window as MetaPixelWindow).fbq?.("track", eventName, params);
}

export function trackMetaCustomEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  initMetaPixel();
  (window as MetaPixelWindow).fbq?.("trackCustom", eventName, params);
}