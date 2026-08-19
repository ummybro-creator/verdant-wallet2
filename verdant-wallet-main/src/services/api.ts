import { useEffect, useState } from "react";
import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { productSrc } from "@/assets";

export type Plan = {
  id: string;
  code: string;
  name: string;
  kind: "daily" | "vip";
  price: number;
  daily: number;
  days: number;
  total: number;
  image: string;
  active: boolean;
  sort: number;
};

export type Profile = {
  id: string;
  phone: string;
  user_code: string;
  vip: string;
  invite_code: string;
  balance: number;
  total_recharge: number;
  total_income: number;
  fixed_income: number;
  full_name: string | null;
  email: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  upi_id: string | null;
  blocked: boolean;
  created_at: string;
};

export type Txn = {
  id: string;
  type: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
};

export type Settings = {
  upi_id: string;
  payee_name: string;
  min_recharge: number;
  min_withdraw: number;
  tax_percent: number;
  level1_rate: number;
  level2_rate: number;
  level3_rate: number;
  recharge_presets: number[];
  support_url: string | null;
  channel_url: string | null;
  apk_url: string | null;
  maintenance: boolean;
};

export const planImage = (_key?: string) => productSrc;

export const phoneToEmail = (phone: string) => `${phone}@coolio.app`;

/* ---------------- session ---------------- */

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Supabase can briefly emit a null session while restoring or refreshing
      // a persisted session. Do not make protected routes redirect during that
      // transient state; the initial getSession call is the source of truth.
      if (s || event === "SIGNED_OUT") setSession(s);
      qc.invalidateQueries();
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setReady(true);
      })
      .catch((error) => {
        console.error("[Auth] Failed to restore session", error);
        setReady(true);
      });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return { session, ready, userId: session?.user.id ?? null };
}

const authed = <T,>(
  key: unknown[],
  fn: () => Promise<T>,
  enabled = true,
): UseQueryOptions<T> => ({ queryKey: key, queryFn: fn, enabled }) as UseQueryOptions<T>;

/* ---------------- queries ---------------- */

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("sort");
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from("app_settings").select("*").single();
      if (error) throw error;
      return data as unknown as Settings;
    },
  });
}

export function useProfile() {
  const { userId } = useSession();
  return useQuery(
    authed<Profile | null>(
      ["profile", userId],
      async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId!)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as Profile | null;
      },
      !!userId,
    ),
  );
}

export function useIsAdmin() {
  const { userId } = useSession();
  return useQuery(
    authed<boolean>(
      ["is-admin", userId],
      async () => {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId!)
          .eq("role", "admin")
          .maybeSingle();
        if (error) throw error;
        return !!data;
      },
      !!userId,
    ),
  );
}

export function useTransactions() {
  const { userId } = useSession();
  return useQuery(
    authed<Txn[]>(
      ["transactions", userId],
      async () => {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return (data ?? []) as unknown as Txn[];
      },
      !!userId,
    ),
  );
}

export function useNotifications() {
  const { userId } = useSession();
  return useQuery(
    authed<
      { id: string; title: string; body: string | null; read: boolean; created_at: string }[]
    >(
      ["notifications", userId],
      async () => {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as never;
      },
      !!userId,
    ),
  );
}

export type TeamData = {
  size: number;
  recharge: number;
  members: { phone: string; joined: string; recharge: number }[];
};

export function useTeam() {
  const { userId } = useSession();
  return useQuery(
    authed<TeamData>(
      ["team", userId],
      async () => {
        const { data, error } = await supabase.rpc("my_team");
        if (error) throw error;
        return data as unknown as TeamData;
      },
      !!userId,
    ),
  );
}

export function usePurchases() {
  const { userId } = useSession();
  return useQuery(
    authed<
      {
        id: string;
        amount: number;
        daily: number;
        days: number;
        status: string;
        started_at: string;
        ends_at: string;
        plans: { name: string; image: string } | null;
      }[]
    >(
      ["purchases", userId],
      async () => {
        const { data, error } = await supabase
          .from("purchases")
          .select("*, plans(name, image)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as never;
      },
      !!userId,
    ),
  );
}

export function useDeposits() {
  const { userId } = useSession();
  return useQuery(
    authed<{ id: string; amount: number; utr: string; status: string; created_at: string }[]>(
      ["deposits", userId],
      async () => {
        const { data, error } = await supabase
          .from("deposits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as never;
      },
      !!userId,
    ),
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
