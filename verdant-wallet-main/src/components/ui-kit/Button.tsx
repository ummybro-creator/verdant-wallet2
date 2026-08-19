import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-wide transition-colors disabled:opacity-60 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "gradient-primary text-primary-foreground shadow-cta",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-card text-foreground",
        ghost: "text-primary-dark",
        danger: "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-[15px] uppercase",
        block: "h-12 w-full text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = Omit<HTMLMotionProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    children?: React.ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  loading,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

export function PrimaryButton(props: Props) {
  return <Button variant="primary" size="block" {...props} />;
}

export function SecondaryButton(props: Props) {
  return <Button variant="secondary" size="block" {...props} />;
}
