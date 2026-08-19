import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/layout/InfoPage";

export const Route = createFileRoute("/profile/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Velvato" },
      { name: "description", content: "How Velvato collects, stores and protects your data." },
      { property: "og:title", content: "Privacy policy — Velvato" },
      { property: "og:description", content: "Our commitments on data collection and security." },
    ],
  }),
  component: () => (
    <InfoPage
      title="Privacy Policy"
      intro="We collect only the data required to operate your wallet and process payouts."
      sections={[
        {
          heading: "Data we collect",
          body: "Mobile number, bank/UPI details for payouts, device information and transaction history.",
        },
        {
          heading: "How we use it",
          body: "To verify identity, process recharges and withdrawals, prevent fraud and provide support.",
        },
        {
          heading: "Your rights",
          body: "You can request a copy or deletion of your data at any time via support@velvato.app.",
        },
      ]}
    />
  ),
});
