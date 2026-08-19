import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/layout/InfoPage";

export const Route = createFileRoute("/profile/about")({
  head: () => ({
    meta: [
      { title: "About Velvato — company information" },
      { name: "description", content: "Learn about Velvato, our mission and company policies." },
      { property: "og:title", content: "About Velvato" },
      { property: "og:description", content: "Who we are and how the Velvato platform works." },
    ],
  }),
  component: () => (
    <InfoPage
      title="About Us"
      intro="Velvato is a mobile-first earnings platform built for delivery partners and their communities across India."
      sections={[
        {
          heading: "Our mission",
          body: "Make daily earnings transparent, instant and accessible from any phone, with no hidden fees.",
        },
        {
          heading: "How it works",
          body: "Recharge your wallet, activate a daily income or VIP plan, and receive automatic credits every day at 09:00 IST.",
        },
        {
          heading: "Support",
          body: "Our team is available 24/7 through in-app chat and the official channel.",
        },
      ]}
    />
  ),
});
