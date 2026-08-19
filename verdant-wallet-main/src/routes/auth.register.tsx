import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/auth/register")({
  head: () => ({
    meta: [
      { title: "Create your Velvato account" },
      {
        name: "description",
        content: "Register with your mobile number, set passwords and add a referral code.",
      },
      { property: "og:title", content: "Create your Velvato account" },
      {
        property: "og:description",
        content: "Join Velvato and start earning with daily income and VIP plans.",
      },
    ],
  }),
  component: () => <AuthScreen mode="register" />,
});
