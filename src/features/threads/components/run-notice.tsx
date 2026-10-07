import {
  CircleSlashIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RunSummary } from "@/lib/types";

/**
 * How a run that did not complete ended, kept with the thread. `onRetry` is
 * given when the question it belongs to still has no answer to carry the
 * "regenerate" action.
 */
export function RunNotice({
  run,
  onRetry,
}: {
  run: RunSummary;
  onRetry: (() => void) | null;
}) {
  const retry = onRetry && (
    <Button
      className="col-start-2 mt-2 justify-self-start"
      onClick={onRetry}
      size="sm"
      type="button"
      variant="outline"
    >
      <RefreshCwIcon />
      Retry
    </Button>
  );

  if (run.status === "cancelled") {
    return (
      <Alert className="mx-auto max-w-md">
        <CircleSlashIcon />
        <AlertTitle>Stopped</AlertTitle>
        {retry}
      </Alert>
    );
  }

  return (
    <Alert className="mx-auto max-w-md" variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>The run failed</AlertTitle>
      {run.error && <AlertDescription>{run.error}</AlertDescription>}
      {retry}
    </Alert>
  );
}
