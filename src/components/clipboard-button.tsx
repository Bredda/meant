import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Button } from "./ui/button";

type ClipboardButtonProps = {
  content: string;
  /** How long the "copied" state lasts, in milliseconds. */
  timeout?: number;
  onCopiedChanged?: (copied: boolean) => void;
  /** Custom label; defaults to a copy / check icon. */
  children?: (copied: boolean) => ReactNode;
} & Omit<ComponentProps<typeof Button>, "children" | "onClick">;

export function ClipboardButton({
  content,
  timeout = 3000,
  onCopiedChanged,
  children,
  ...props
}: ClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopiedChanged?.(true);
    setTimeout(() => {
      setCopied(false);
      onCopiedChanged?.(false);
    }, timeout);
  };

  if (children) {
    return (
      <Button {...props} onClick={handleCopy}>
        {children(copied)}
      </Button>
    );
  }

  return (
    <Button
      aria-label="Copy"
      size="icon-sm"
      title="Copy"
      variant="ghost"
      {...props}
      onClick={handleCopy}
    >
      {copied ? <CheckIcon /> : <ClipboardCopyIcon />}
    </Button>
  );
}
