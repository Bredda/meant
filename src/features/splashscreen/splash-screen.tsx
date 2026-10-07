import type { BootstrapState } from "@/hooks/use-bootstrap";
import type { AppConfig } from "@/lib/types";
import { SplashError } from "./splash-error";
import { SplashForm } from "./splash-form";
import { SplashLoader } from "./splash-loader";

type SplashcreenProps = {
  state: BootstrapState;
  onComplete: (config: AppConfig) => void;
  className?: string;
};

export function SplashScreen({ state, onComplete }: SplashcreenProps) {
  if (state.status === "error") {
    return <SplashError state={state} />;
  }

  if (state.status === "missing") {
    return <SplashForm onComplete={onComplete} />;
  }

  return <SplashLoader state={state} />;
}
