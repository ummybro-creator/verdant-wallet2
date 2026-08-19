import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/services/api";

export function useAuthGuard() {
  const { session, ready } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) navigate({ to: "/auth/login", replace: true });
  }, [ready, session, navigate]);

  return { session, ready };
}
