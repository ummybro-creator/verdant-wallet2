import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/layout/InfoPage";

export const Route = createFileRoute("/profile/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — Velvato" },
      { name: "description", content: "The rules that govern your use of the Velvato platform." },
      { property: "og:title", content: "Terms of service — Velvato" },
      { property: "og:description", content: "Account, plan and withdrawal terms explained." },
    ],
  }),
  component: () => (
    <InfoPage
      title="Terms of Service"
      intro="By creating an account you agree to the terms below."
      sections={[
        {
          heading: "Accounts",
          body: "One account per mobile number. You are responsible for keeping both passwords secret.",
        },
        {
          heading: "Plans and income",
          body: "Plan returns are credited daily for the stated duration. Purchases cannot be cancelled once active.",
        },
        {
          heading: "Withdrawals",
          body: "A 10% tax applies to each request. Minimum withdrawal is ₹210 and requires a verified bank account.",
        },
      ]}
    />
  ),
});
