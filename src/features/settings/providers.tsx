import { AlertCircleIcon, CheckIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROVIDERS, type ProviderId } from "@/config/providers";
import { useSecrets } from "@/hooks/use-secrets";
import { errorMessage } from "@/lib/errors";

export function ProvidersForm() {
  const { statuses, error, setSecret, deleteSecret } = useSecrets();
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ProviderId, string>>
  >({});

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Vault unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!statuses) {
    return <FieldDescription>Reading vault…</FieldDescription>;
  }

  const configuredCount = statuses.filter((s) => s.isSet).length;

  const setFieldError = (provider: ProviderId, message: string | null) =>
    setFieldErrors((prev) => ({ ...prev, [provider]: message ?? undefined }));

  const save = async (provider: ProviderId) => {
    const value = drafts[provider]?.trim() ?? "";
    const config = PROVIDERS.find((p) => p.id === provider);

    if (!(config && value)) {
      return;
    }
    if (!config.validateKey(value)) {
      setFieldError(provider, `Key must start with "${config.keyPrefix}"`);
      return;
    }

    setBusy(provider);
    try {
      await setSecret(provider, value);
      setDrafts((prev) => ({ ...prev, [provider]: "" }));
      setFieldError(provider, null);
      toast.success(`${config.name} key saved`);
    } catch (err) {
      setFieldError(provider, errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (provider: ProviderId) => {
    const config = PROVIDERS.find((p) => p.id === provider);
    setBusy(provider);
    try {
      await deleteSecret(provider);
      setFieldError(provider, null);
      toast.success(`${config?.name} key removed`);
    } catch (err) {
      setFieldError(provider, errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <FieldSet>
      <FieldLegend>AI Providers</FieldLegend>
      <FieldDescription>
        Keys are stored in your OS vault and never leave your machine. Saved
        keys cannot be read back — enter a new one to replace it.
      </FieldDescription>
      <FieldGroup>
        {PROVIDERS.map((provider) => {
          const isSet =
            statuses.find((s) => s.provider === provider.id)?.isSet ?? false;
          // Setup requires at least one provider; keep that true afterwards.
          const isLast = isSet && configuredCount === 1;
          const draft = drafts[provider.id] ?? "";
          const fieldError = fieldErrors[provider.id];
          const isBusy = busy === provider.id;

          return (
            <Field data-invalid={Boolean(fieldError)} key={provider.id}>
              <div className="flex items-center gap-2">
                <provider.icon className="size-4" />
                <span className="font-medium text-sm">{provider.name}</span>
                {isSet ? (
                  <Badge variant="secondary">
                    <CheckIcon /> Configured
                  </Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
              </div>

              <div className="flex flex-row items-center gap-2">
                <Input
                  aria-invalid={Boolean(fieldError)}
                  aria-label={`${provider.name} API key`}
                  className="flex-1"
                  disabled={isBusy}
                  onChange={(e) => {
                    setDrafts((prev) => ({
                      ...prev,
                      [provider.id]: e.target.value,
                    }));
                    setFieldError(provider.id, null);
                  }}
                  placeholder={
                    isSet
                      ? "••••••••  enter a new key to replace"
                      : provider.placeholder
                  }
                  type="password"
                  value={draft}
                />
                <Button
                  disabled={isBusy || draft.trim().length === 0}
                  onClick={() => save(provider.id)}
                  type="button"
                >
                  {isSet ? "Replace" : "Save"}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span keeps the tooltip reachable while the button is disabled */}
                    <span>
                      <Button
                        aria-label={`Remove ${provider.name} key`}
                        disabled={!isSet || isLast || isBusy}
                        onClick={() => remove(provider.id)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <TrashIcon />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isLast
                      ? "At least one provider must stay configured"
                      : `Remove ${provider.name} key`}
                  </TooltipContent>
                </Tooltip>
              </div>

              {fieldError && <FieldError errors={[{ message: fieldError }]} />}
            </Field>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
}
