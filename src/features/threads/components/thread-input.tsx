import {
  ArrowUpIcon,
  GlobeIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  TelescopeIcon,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

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
    <form className={cn("w-full", className)} onSubmit={handleSend}>
      <InputGroup>
        <InputGroupInput
          onChange={(e) => setInput(e.target.value)}
          value={input}
        />
        <InputGroupAddon align="block-end" className="pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <InputGroupButton
                aria-label="Add files"
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <PlusIcon />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44" side="top">
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
            className="ml-auto"
            disabled={!input || isBusy}
            size="icon-sm"
            type="submit"
            variant="default"
          >
            <ArrowUpIcon />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
