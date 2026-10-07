import { CheckCircle2, ChevronRight, CircleXIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ThreadToolCall, ThreadToolResult } from "@/lib/types";
import { formatJson } from "@/lib/utils";

export function ToolCallItem({
  call,
  result,
}: {
  call: ThreadToolCall;
  result?: ThreadToolResult;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = !result;
  const isFailed = result?.isError === true;

  return (
    <div className="w-full max-w-md rounded-lg border bg-muted/40 text-sm">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <ChevronRight
          className={`size-4 shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />

        {isPending && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {isFailed && (
          <CircleXIcon className="size-4 shrink-0 text-destructive" />
        )}
        {!(isPending || isFailed) && (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        )}

        <span className="font-mono text-muted-foreground text-xs">
          {call.toolName}
        </span>

        <span
          className={`ml-auto text-xs ${
            isFailed ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {isPending && "running…"}
          {isFailed && "failed"}
          {!(isPending || isFailed) && "done"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t px-3 py-2">
          <div>
            <div className="mb-1 font-medium text-muted-foreground text-xs">
              Arguments
            </div>
            <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
              {formatJson(call.content)}
            </pre>
          </div>

          {result && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground text-xs">
                Result
              </div>
              <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
                {formatJson(result.content)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
