import { ArrowUpIcon, SquareIcon } from "lucide-react";
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
  /** Stops the running response; `null` while the run is not yet stoppable. */
  onCancel: (() => void) | null;
  className?: string;
};
export function ThreadInput({
  isBusy,
  onSubmit,
  onCancel,
  className,
}: ThreadInputProps) {
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
          {isBusy ? (
            <InputGroupButton
              className="ml-auto"
              disabled={!onCancel}
              onClick={() => onCancel?.()}
              size="icon-sm"
              type="button"
              variant="default"
            >
              <SquareIcon />
              <span className="sr-only">Stop</span>
            </InputGroupButton>
          ) : (
            <InputGroupButton
              className="ml-auto"
              disabled={!input}
              size="icon-sm"
              type="submit"
              variant="default"
            >
              <ArrowUpIcon />
              <span className="sr-only">Send</span>
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
