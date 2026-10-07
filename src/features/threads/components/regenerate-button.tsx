import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Answers the last user message again, replacing the current answer. */
export function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      aria-label="Regenerate"
      onClick={onClick}
      size="icon-sm"
      title="Regenerate"
      type="button"
      variant="ghost"
    >
      <RefreshCwIcon />
    </Button>
  );
}
