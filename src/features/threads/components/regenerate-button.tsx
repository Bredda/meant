import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Answers the last user message again, replacing the current answer. */
export function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <Button onClick={onClick} size="sm" type="button" variant="ghost">
        <RefreshCwIcon />
        Regenerate
      </Button>
    </div>
  );
}
