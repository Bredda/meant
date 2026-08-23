import {
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenu,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  PlusIcon,
  PaperclipIcon,
  ImageIcon,
  TelescopeIcon,
  GlobeIcon,
  ArrowUpIcon,
} from "lucide-react";

import { useState } from "react";

type ThreadInputProps = {
  isBusy: boolean;
  onSubmit: (input: string) => void;
  className?: string;
};
export function ThreadInput({ isBusy, onSubmit, className }: ThreadInputProps) {
  const [input, setInput] = useState("");

  const handleSend = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim() || isBusy) {
      return;
    }

    onSubmit(input);
    setInput("");
  };

  return (
    <form onSubmit={handleSend} className={cn("w-full", className)}>
      <InputGroup>
        <InputGroupInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <InputGroupAddon align="block-end" className="pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <InputGroupButton
                aria-label="Add files"
                type="button"
                size="icon-sm"
                variant="outline"
              >
                <PlusIcon />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-44">
              <DropdownMenuItem>
                <PaperclipIcon />
                Add Photos & Files
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <ImageIcon />
                Create Image
              </DropdownMenuItem>
              <DropdownMenuItem>
                <TelescopeIcon />
                Deep Research
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GlobeIcon />
                Web Search
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            disabled={!input || isBusy}
            className="ml-auto"
          >
            <ArrowUpIcon />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
