import { CheckIcon, ClipboardCopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface ClipboardButtonProps {
  content: string;
  copied?: boolean;
  onCopiedChanged?: (copied: boolean) => void;
}

export function Clipboardbutton({
  content,
  copied,
  onCopiedChanged,
}: ClipboardButtonProps) {
  const [_copied, _setCopied] = useState(copied ?? false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    _setCopied(true);
    onCopiedChanged?.(true);
    setTimeout(() => {
      _setCopied(false);
      onCopiedChanged?.(false);
    }, 3000);
  };

  return (
    <Button
      aria-label="Copy"
      onClick={handleCopy}
      size="icon-sm"
      title="Copy"
      variant="ghost"
    >
      {_copied ? <CheckIcon /> : <ClipboardCopyIcon />}
    </Button>
  );
}
