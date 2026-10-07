import { Progress } from "@/components/ui/progress";
import type { BootstrapState } from "@/hooks/use-bootstrap";
import { cn } from "@/lib/utils";
import { Field, FieldLabel } from "../../components/ui/field";

type SplashLoaderProps = {
  state: BootstrapState;
  className?: string;
};

export function SplashLoader({ state, className }: SplashLoaderProps) {
  if (state.status === "error" || state.status === "missing") {
    return null;
  }
  return (
    <Field className={cn("w-full max-w-lg", className)}>
      <FieldLabel htmlFor="progress-upload">
        <span className="text-muted-foreground">
          {state.step === "vault" && "Checking OS vault availability"}
          {state.step === "config" && "Loading local user config"}
          {state.step === "done" && "Welcome back"}
        </span>
        <span className="ml-auto">{state.progress}%</span>
      </FieldLabel>
      <Progress id="progress-upload" value={state.progress} />
    </Field>
  );
}
