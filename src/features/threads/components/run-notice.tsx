import { CircleSlashIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { RunSummary } from "@/lib/types";

/** How a run that did not complete ended, kept with the thread. */
export function RunNotice({ run }: { run: RunSummary }) {
  if (run.status === "cancelled") {
    return (
      <Alert className="mx-auto max-w-md">
        <CircleSlashIcon />
        <AlertTitle>Stopped</AlertTitle>
      </Alert>
    );
  }

  return (
    <Alert className="mx-auto max-w-md" variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>The run failed</AlertTitle>
      {run.error && <AlertDescription>{run.error}</AlertDescription>}
    </Alert>
  );
}
