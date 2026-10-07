import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
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
