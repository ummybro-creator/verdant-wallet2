import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";

export function CopyButton({
  value,
  label = "Copy",
  withIcon = false,
}: {
  value: string;
  label?: string;
  withIcon?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Button size="md" onClick={copy} className="px-7">
      {withIcon &&
        (copied ? <Check className="size-4" /> : <Copy className="size-4" />)}
      {copied ? "Copied" : label}
    </Button>
  );
}
