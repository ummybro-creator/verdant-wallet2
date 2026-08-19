import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Login — Velvato" },
      { name: "description", content: "Login to Velvato with your mobile number and password." },
      { property: "og:title", content: "Login — Velvato" },
      { property: "og:description", content: "Access your Velvato wallet and income plans." },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
