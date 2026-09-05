import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_META_PIXEL_ID = "1076043171806461";

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
let initPromise: Promise<void> | null = null;
let activePixelId: string | null = null;

export async function initMetaPixel() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    let pixelId = DEFAULT_META_PIXEL_ID;
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get("ref") || urlParams.get("referral") || urlParams.get("code") || urlParams.get("invite") || urlParams.get("r") || sessionStorage.getItem("velvato_ref");
      
      if (ref) {
        sessionStorage.setItem("velvato_ref", ref);
        const { data } = await supabase.rpc("get_meta_pixel_id", { p_invite_code: ref });
        if (data) {
          pixelId = data;
        }
      }
    } catch (err) {
      console.error("Failed to fetch custom pixel ID", err);
    }
    
    activePixelId = pixelId;
    
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

    pixelWindow.fbq?.("init", pixelId);
    pixelWindow.fbq?.("track", "PageView");
    initialized = true;
  })();
  
  return initPromise;
}

export async function trackMetaEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  if (!initialized) await initMetaPixel();
  (window as MetaPixelWindow).fbq?.("track", eventName, params ?? {});
}

export async function trackMetaCustomEvent(eventName: string, params?: MetaEventParams) {
  if (typeof window === "undefined") return;
  if (!initialized) await initMetaPixel();
  (window as MetaPixelWindow).fbq?.("trackCustom", eventName, params ?? {});
}

export async function trackMetaSubscribe(params?: MetaEventParams) {
  await trackMetaEvent("Subscribe", params);
}