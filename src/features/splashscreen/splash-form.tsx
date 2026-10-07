import { useForm } from "@tanstack/react-form";
import { AlertCircleIcon, Trash } from "lucide-react";
import { useState } from "react";
import z from "zod";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDER_MAP, PROVIDERS, type ProviderId } from "@/config/providers";
import { useUpdateConfig } from "@/hooks/use-config-update";
import { storeSecret } from "@/hooks/use-secrets";
import { errorMessage } from "@/lib/errors";
import { preferencesSchema } from "@/lib/schemas";
import type { AppConfig } from "@/lib/types";

const formSchema = z
  .object({
    ...(Object.fromEntries(
      PROVIDERS.map((p) => [p.id, z.string().optional()])
    ) as Record<ProviderId, z.ZodOptional<z.ZodString>>),
    username: preferencesSchema.shape.username,
    theme: preferencesSchema.shape.theme,
  })
  .partial()
  .superRefine((data, ctx) => {
    const activeIds = PROVIDERS.map((p) => p.id).filter(
      (id) => data[id] !== undefined
    );

    if (activeIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "You must add at least one provider",
        path: [], // volontairement root : ce n'est l'erreur d'aucun champ précis
      });
      return;
    }

    for (const id of activeIds) {
      const provider = PROVIDER_MAP[id];
      const value = data[id] ?? "";
      if (!value.trim()) {
        ctx.addIssue({
          code: "custom",
          message: `${provider.name} key is required`,
          path: [id], // ← attache l'erreur au champ `id`, pas à la racine
        });
      } else if (!provider.validateKey(value)) {
        ctx.addIssue({
          code: "custom",
          message: `${provider.name} key must start with "${provider.keyPrefix}"`,
          path: [id], // ← idem
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

type SplashFormProps = {
  onComplete: (config: AppConfig) => void;
};

export function SplashForm({ onComplete }: SplashFormProps) {
  const [backError, setBackError] = useState<string | null>(null);
  const update = useUpdateConfig();
  const { theme, applyTheme } = useTheme();
  const form = useForm({
    defaultValues: {
      theme: theme ?? "system",
      username: "",
    } as FormValues,
    validators: {
      onChange: formSchema,
      onSubmit: formSchema,
    },

    onSubmit: async ({ value }) => {
      setBackError(null);
      try {
        // Keys first, config file last: the presence of config.toml is what
        // marks setup as done at the next boot. Writing it before the vault
        // succeeds would let the app start up with no credentials at all.
        for (const { id } of PROVIDERS) {
          const key = value[id]?.trim();
          if (key) {
            await storeSecret(id, key);
          }
        }

        const config = await update({
          theme: value.theme,
          username: value.username,
        });

        onComplete(config);
      } catch (error) {
        console.error(error);
        setBackError(errorMessage(error));
      }
    },
  });

  return (
    <div className="mx-auto w-6xl">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldSet className="mx-auto w-1/2">
          <FieldLegend>Your preferences</FieldLegend>
          <FieldDescription>Setup your preferences.</FieldDescription>
          <FieldGroup>
            <form.Field
              // biome-ignore lint/correctness/noChildrenProp: shadcn
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} orientation="responsive">
                    <FieldContent>
                      <FieldLabel htmlFor="input-username">Username</FieldLabel>
                      <FieldDescription>
                        Your display name. Must be between 3 and 10 characters.
                        Must only contain letters, numbers, and underscores.
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </FieldContent>

                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="username"
                      className="min-w-1/2"
                      id="input-username"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="shadcn"
                      value={field.state.value}
                    />
                  </Field>
                );
              }}
              name="username"
            />
            <form.Field
              // biome-ignore lint/correctness/noChildrenProp: shadcn
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} orientation="responsive">
                    <FieldContent>
                      <FieldLabel htmlFor="select-theme">Theme</FieldLabel>
                      <FieldDescription>
                        Select your prefered theme.
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </FieldContent>
                    <Select
                      name={field.name}
                      onValueChange={(value) =>
                        field.handleChange(value as Theme)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={isInvalid}
                        className="min-w-[120px]"
                        id="select-theme"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent position="item-aligned">
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>

                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                );
              }}
              listeners={{
                onChange: ({ value }) => {
                  applyTheme(value as Theme);
                },
              }}
              name="theme"
            />
          </FieldGroup>
        </FieldSet>
        <FieldSet className="mx-auto w-1/2">
          <FieldLegend>Bring your own Key</FieldLegend>
          <FieldDescription>
            Setup at least one AI provider. Your API keys are encrypted and
            stored securely on your OS vault.
          </FieldDescription>
          {/* form.Store sur o values to find active ones */}

          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              const activeIds = PROVIDERS.map((p) => p.id).filter(
                (id) => values[id] !== undefined
              );
              const availableProviders = PROVIDERS.filter(
                (p) => !activeIds.includes(p.id)
              );

              return (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={availableProviders.length === 0}
                        variant="outline"
                      >
                        Add provider
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {PROVIDERS.map((provider) => (
                        <DropdownMenuItem
                          disabled={activeIds.includes(provider.id)}
                          key={provider.id}
                          onClick={() => form.setFieldValue(provider.id, "")}
                        >
                          <provider.icon className="size-4" /> {provider.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {activeIds.map((id) => {
                    const provider = PROVIDER_MAP[id];
                    return (
                      <form.Field key={id} name={id}>
                        {(field) => (
                          <Field
                            data-invalid={field.state.meta.errors.length > 0}
                          >
                            <div className="flex flex-row items-center gap-2">
                              <FieldLabel
                                className="max-w-[80px]"
                                htmlFor={field.name}
                              >
                                <provider.icon className="size-4" />{" "}
                                {provider.name}
                              </FieldLabel>
                              <Input
                                aria-invalid={
                                  field.state.meta.errors.length > 0
                                }
                                className="flex-1"
                                id={field.name}
                                name={field.name}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder={provider.placeholder}
                                type="password"
                                value={field.state.value ?? ""}
                              />
                              <Button
                                onClick={() => form.deleteField(id)}
                                size="icon"
                                type="button"
                                variant="outline"
                              >
                                <Trash />
                              </Button>
                            </div>
                            {field.state.meta.errors.length > 0 && (
                              <FieldError
                                errors={field.state.meta.errors.map(
                                  (e) =>
                                    e && {
                                      message:
                                        typeof e === "string" ? e : e.message,
                                    }
                                )}
                              />
                            )}
                          </Field>
                        )}
                      </form.Field>
                    );
                  })}
                </>
              );
            }}
          </form.Subscribe>
        </FieldSet>
        <div className="mx-auto w-1/2">
          <form.Subscribe selector={(state) => state.errors}>
            {(errors) => {
              const messages = errors.flatMap((errorMap) =>
                Object.values(errorMap ?? {}).flatMap((issues) =>
                  (issues ?? []).map((issue) => issue.message)
                )
              );

              // Dedup : onChange and onSubmitcan produce the same issue
              const uniqueMessages = Array.from(new Set(messages));

              return uniqueMessages.length > 0 ? (
                <Alert className="max-w-full" variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Validation failed</AlertTitle>
                  <AlertDescription>
                    {uniqueMessages.join(", ")}
                  </AlertDescription>
                </Alert>
              ) : null;
            }}
          </form.Subscribe>
        </div>
        <FieldSeparator className="mx-auto mb-6 w-1/2" />
        {backError && (
          <Alert className="mx-auto w-1/2" variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Setup failed</AlertTitle>
            <AlertDescription>{backError}</AlertDescription>
          </Alert>
        )}
        <div className="mx-auto w-1/2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button className="w-full" disabled={!canSubmit} type="submit">
                {isSubmitting ? "..." : "Wrap up setup"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
