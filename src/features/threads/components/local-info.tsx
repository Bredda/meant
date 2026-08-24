import { IdCard } from "lucide-react";
import { useState } from "react";
import { ClipboardButton } from "@/components/content-clipboard-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Thread } from "@/lib/types";

export function LocalInfos({ thread }: { thread: Thread }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon" variant="secondary">
              <IdCard />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Thread infos</TooltipContent>
      </Tooltip>
      <PopoverContent className="min-w-[350px]">
        <div className="w-full space-y-2">
          <div className="flex w-full items-center gap-2">
            <span className="w-[80px] text-muted-foreground text-sm">Id</span>
            <ClipboardButton
              className="flex-1"
              content={thread.id}
              variant="secondary"
            />
          </div>
          <div className="flex w-full items-center gap-2">
            <span className="max-w-[80px] text-muted-foreground text-sm">
              Path
            </span>
            <ClipboardButton
              className="flex-1"
              content="to be done"
              variant="secondary"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
