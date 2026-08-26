import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { logoSrc, bannerSlides } from "@/assets";
import { Input, PasswordInput, PhoneInput } from "@/components/ui-kit/Input";
import { PrimaryButton } from "@/components/ui-kit/Button";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail } from "@/services/api";
import { trackMetaEvent, trackMetaSubscribe } from "@/lib/meta-pixel";

const loginSchema = z.object({
  phone: z.string().refine((v) => /^[6-9]\d{9}$/.test(v) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
    message: "Enter a valid mobile number or email",
  }),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z
  .object({
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string(),
    withdrawPassword: z.string().min(6, "Withdrawal password must be 6+ characters"),
    referral: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

function Logo() {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="absolute left-1/2 top-0 z-20 flex size-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-card shadow-card"
    >
      <img src={logoSrc} alt="Velvato Ice Cream logo" className="size-full object-cover" />
    </motion.div>
  );
}

function AuthTabs({ mode }: { mode: "login" | "register" }) {
  return (
    <div className="grid grid-cols-2">
      {(
        [
          { to: "/auth/login", label: "Login", key: "login" },
          { to: "/auth/register", label: "Register", key: "register" },
        ] as const
      ).map((t) => (
        <Link key={t.key} to={t.to} className="relative pb-3 text-center">
          <span
            className={
              t.key === mode
                ? "text-[20px] font-bold text-foreground"
                : "text-[20px] font-bold text-muted-foreground/70"
            }
          >
            {t.label}
          </span>
          {t.key === mode && (
            <motion.span
              layoutId="auth-tab"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary"
            />
          )}
        </Link>
      ))}
    </div>
  );
}

const getInitialReferral = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const ref =
    params.get("ref") ||
    params.get("referral") ||
    params.get("code") ||
    params.get("invite") ||
    params.get("r");
  if (ref) {
    try {
      sessionStorage.setItem("velvato_ref", ref);
    } catch {}
    return ref;
  }
  try {
    return sessionStorage.getItem("velvato_ref") || "";
  } catch {
    return "";
  }
};

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // If the user already has an active session, auto-redirect directly to home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        navigate({ to: "/home", replace: true });
      }
    });
  }, [navigate]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      phone: "",
      password: "",
      confirm: "",
      withdrawPassword: "",
      referral: getInitialReferral(),
    },
  });

  const doLogin = async (v: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const email = v.phone.includes("@") ? v.phone.trim().toLowerCase() : phoneToEmail(v.phone);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: v.password,
    });
    setLoading(false);
    if (error) {
      toast.error("Incorrect mobile number or password");
      return;
    }
    if (!data.session) {
      toast.error("Login session could not be created. Please try again.");
      return;
    }
    toast.success("Welcome back!");
    trackMetaSubscribe({ method: "login" });
    trackMetaEvent("Login", { method: "password" });
    window.location.href = "/home";
  };

  const doRegister = async (v: z.infer<typeof registerSchema>) => {
    setLoading(true);

    // Use our custom RPC to bypass GoTrue email rate limits completely
    // The RPC returns the exact email it stored so we can sign in with it immediately
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("custom_register", {
      p_phone: v.phone,
      p_password: v.password,
      p_withdraw_password: v.withdrawPassword,
      p_referral: (v.referral ?? "").toUpperCase(),
    });

    if (rpcError) {
      setLoading(false);
      toast.error(
        rpcError.message.toLowerCase().includes("already")
          ? "This mobile number is already registered"
          : rpcError.message
      );
      return;
    }

    // Use the exact email returned by the RPC
    const registeredEmail = (rpcData as string) || phoneToEmail(v.phone);

    // Automatically authenticate the newly registered user (with retry if needed)
    let authenticated = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: registeredEmail,
        password: v.password,
      });

      if (!signInError && signInData?.session) {
        authenticated = true;
        break;
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setLoading(false);

    if (!authenticated) {
      toast.error("Account created! Please sign in.");
      navigate({ to: "/auth/login", replace: true });
      return;
    }

    // Track successful registration and subscription events
    toast.success("Account created! Welcome to Velvato.");
    trackMetaSubscribe({ method: "register" });
    trackMetaEvent("CompleteRegistration", { status: "success", method: "password" });

    // Automatically redirect directly to home screen without requiring another login
    window.location.href = "/home";
  };

  return (
    <div className="min-h-screen w-full bg-muted/60">
      <div className="mx-auto min-h-screen w-full max-w-[520px] bg-card">
        <div className="relative">
          <img
            src={bannerSlides[0]!.src}
            alt="Velvato ice cream promotional banner"
            width={1200}
            height={640}
            fetchPriority="high"
            decoding="async"
            className="h-[180px] w-full object-cover sm:h-[210px]"
          />
          <div className="relative rounded-t-[32px] bg-card pt-[64px]">
            <Logo />
            <div className="px-5 pb-10">
              <AuthTabs mode={mode} />

              {mode === "login" ? (
                <form className="mt-6 space-y-4" onSubmit={loginForm.handleSubmit(doLogin)}>
                  <Input
                    placeholder="Mobile number or email"
                    autoComplete="username"
                    {...loginForm.register("phone")}
                    {...(loginForm.formState.errors.phone?.message
                      ? { error: loginForm.formState.errors.phone.message }
                      : {})}
                  />
                  <PasswordInput
                    placeholder="Enter password"
                    {...loginForm.register("password")}
                    {...(loginForm.formState.errors.password?.message
                      ? { error: loginForm.formState.errors.password.message }
                      : {})}
                  />
                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-3 text-[13px] font-medium text-foreground">
                      <input type="checkbox" className="size-4 accent-[oklch(0.63_0.235_5)]" />
                      Remember me
                    </label>
                    <Link
                      to="/profile/security"
                      className="text-[13px] font-bold text-primary-dark"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PrimaryButton
                    type="submit"
                    loading={loading}
                    className="mt-2"
                    onClick={() => {
                      trackMetaSubscribe({ action: "login_button_click" });
                    }}
                  >
                    LOGIN
                  </PrimaryButton>
                  <p className="text-center text-[13px] text-muted-foreground">
                    Don't have an account?{" "}
                    <Link to="/auth/register" className="font-bold text-primary-dark">
                      Register
                    </Link>
                  </p>
                </form>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={registerForm.handleSubmit(doRegister)}>
                  <PhoneInput
                    {...registerForm.register("phone")}
                    {...(registerForm.formState.errors.phone?.message
                      ? { error: registerForm.formState.errors.phone.message }
                      : {})}
                  />
                  <PasswordInput
                    placeholder="Enter login password"
                    {...registerForm.register("password")}
                    {...(registerForm.formState.errors.password?.message
                      ? { error: registerForm.formState.errors.password.message }
                      : {})}
                  />
                  <PasswordInput
                    placeholder="Confirm login password"
                    {...registerForm.register("confirm")}
                    {...(registerForm.formState.errors.confirm?.message
                      ? { error: registerForm.formState.errors.confirm.message }
                      : {})}
                  />
                  <PasswordInput
                    placeholder="Enter withdrawal password"
                    {...registerForm.register("withdrawPassword")}
                    {...(registerForm.formState.errors.withdrawPassword?.message
                      ? { error: registerForm.formState.errors.withdrawPassword.message }
                      : {})}
                  />
                  <Input
                    placeholder="Referral code"
                    leading={<Users className="size-5 text-primary" />}
                    {...registerForm.register("referral")}
                  />
                  <PrimaryButton
                    type="submit"
                    loading={loading}
                    className="mt-2"
                    onClick={() => {
                      trackMetaSubscribe({ action: "register_button_click" });
                    }}
                  >
                    REGISTER
                  </PrimaryButton>
                  <p className="text-center">
                    <Link to="/auth/login" className="text-[13px] font-bold text-primary-dark">
                      I already have an account
                    </Link>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
