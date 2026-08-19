import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, error, ...props },
  ref,
) {
  return (
    <div className="w-full">
      <div
        className={cn(
          "flex h-16 w-full items-center gap-3 rounded-full bg-input px-6 transition-colors focus-within:bg-primary-soft",
          error && "ring-1 ring-destructive",
          className,
        )}
      >
        {leading}
        <input
          ref={ref}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
          {...props}
        />
        {trailing}
      </div>
      {error && <p className="mt-1.5 pl-6 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        trailing={
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
            className="text-muted-foreground"
          >
            {show ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
          </button>
        }
        {...props}
      />
    );
  },
);

export function PhoneInput(props: InputProps) {
  return (
    <Input
      inputMode="numeric"
      placeholder="Enter mobile number"
      leading={
        <span className="flex items-center gap-3 pr-1">
          <span className="text-[17px] font-extrabold text-primary">+91</span>
          <span className="h-7 w-px bg-border" />
        </span>
      }
      {...props}
    />
  );
}
