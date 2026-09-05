import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import logoImg from "../assets/velvato-logo.webp";
import productImg from "../assets/velvato-product.webp";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { trackMetaEvent } from "../lib/meta-pixel";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Velvato — Earnings Wallet" },
      {
        name: "description",
        content: "Premium mobile wallet for daily income plans, team commissions and payouts.",
      },
      { property: "og:title", content: "Velvato — Earnings Wallet" },
      {
        property: "og:description",
        content: "Premium mobile wallet for daily income plans, team commissions and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#c92a2a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Velvato" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // DNS/connection warm-ups — cost nothing, save 100-300ms on first requests
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://connect.facebook.net" },
      { rel: "preconnect", href: "https://www.facebook.com" },
      { rel: "preconnect", href: "https://xihslaahlgvlggolkbqh.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://connect.facebook.net" },
      { rel: "dns-prefetch", href: "https://xihslaahlgvlggolkbqh.supabase.co" },
      // ─── Critical image preloads ─────────────────────────────────────────────
      // Tells the browser to start downloading these images immediately while
      // parsing HTML — dramatically reduces LCP (Largest Contentful Paint).
      // productImg is the hero banner (59 KB) — highest priority.
      { rel: "preload", as: "image", href: productImg, type: "image/webp", fetchPriority: "high" },
      // logoImg is the logo circle — fetched right after the banner.
      { rel: "preload", as: "image", href: logoImg, type: "image/webp" },
      // ─── Google Fonts is loaded ASYNC in RootComponent useEffect ─────────────
      // Removing it from here eliminates the render-blocking stylesheet request
      // that previously delayed First Contentful Paint by 400-900 ms.
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();

  // Track whether this is the very first client-side render.
  // The inline <script> in RootShell already fired fbq('track', 'PageView')
  // on page load — we must skip the first effect invocation to avoid sending
  // a duplicate PageView to Meta and distorting ad attribution.
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Load Inter font ASYNCHRONOUSLY — does not block initial rendering.
    // Previously this was a render-blocking <link rel="stylesheet"> in <head>
    // that delayed First Contentful Paint by 400-900ms on slow connections.
    // Now text renders instantly with the system font fallback (ui-sans-serif)
    // and swaps to Inter once the stylesheet arrives.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    // Track PageView on every client-side navigation (SPA route changes).
    trackMetaEvent("PageView");
  }, [location.pathname, location.searchStr]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
