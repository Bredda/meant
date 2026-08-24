import type { VariantProps } from "class-variance-authority";
import { useState } from "react";
import { Button, type buttonVariants } from "./ui/button";

type ClipboardButtonProps = {
  content: string;
  timeout?: number;
} & React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function ClipboardButton({
  content,
  timeout,
  ...props
}: ClipboardButtonProps) {
  const [copied, setCopied] = useState(false);
  const _timeout = timeout ?? 5000;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, _timeout);
  };

  return (
    <Button {...props} onClick={handleCopy}>
      {copied ? "copied" : content}
    </Button>
  );
}
