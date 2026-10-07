import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BootstrapState } from "@/hooks/use-bootstrap";

type SplashErrorProps = {
  state: BootstrapState;
};

export function SplashError({ state }: SplashErrorProps) {
  const isVaultError = state.step === "vault" && state.status === "error";
  const isconfigError = state.step === "config" && state.status === "error";
  return (
    <Alert className="max-w-md" variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>
        {isVaultError && "OS Vault unavailable"}
        {isconfigError && "Config Store unavailable"}
      </AlertTitle>
      <AlertDescription>
        {isVaultError && (
          <div>
            <div>
              Meant uses your OS vault in order to securely store your secrets
              but it seems it is currently unavailable.
            </div>
            <div>Reason: {state.reason}</div>
          </div>
        )}
        {isconfigError && (
          <div>
            <div>Meant could not initialize configuration store.</div>
            <div>Reason: {state.reason}</div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
