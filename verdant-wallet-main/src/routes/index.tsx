import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Velvato — Login to your delivery earnings wallet" },
      {
        name: "description",
        content:
          "Sign in to Velvato to manage your wallet, daily income plans, team commissions and withdrawals.",
      },
      { property: "og:title", content: "Velvato — Login to your earnings wallet" },
      {
        property: "og:description",
        content: "Manage your wallet, income plans, team and withdrawals with Velvato.",
      },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
