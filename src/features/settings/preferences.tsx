import { useForm } from "@tanstack/react-form";
import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
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
import { useUpdateConfig } from "@/hooks/use-config-update";
import { type PreferencesValues, preferencesSchema } from "@/lib/schemas";
import { useConfigStore } from "@/stores/config-store";

export function PreferencesForm() {
  const [backError, setBackError] = useState<string | null>(null);
  const update = useUpdateConfig();
  const { applyTheme } = useTheme();
  const config = useConfigStore((s) => s.config);

  const form = useForm({
    defaultValues: {
      theme: config?.theme ?? "system",
      username: config?.username ?? "",
    } as PreferencesValues,
    validators: {
      onSubmit: preferencesSchema,
    },

    onSubmit: async ({ value }) => {
      setBackError(null);
      try {
        await update({ theme: value.theme as Theme, username: value.username });
        toast.success("Preferences saved");
      } catch (_error) {
        console.error(_error);
        setBackError(_error as unknown as string);
      }
    },
  });
  if (!config) {
    return null;
  }
  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Preferences</FieldLegend>
            <FieldDescription>Saved locally in config.toml.</FieldDescription>
            <FieldGroup>
              <form.Field
                // biome-ignore lint/correctness/noChildrenProp: shadcn
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} orientation="responsive">
                      <FieldContent>
                        <FieldLabel htmlFor="input-username">
                          Username
                        </FieldLabel>
                        <FieldDescription>
                          Your display name. Must be between 3 and 10
                          characters. Must only contain letters, numbers, and
                          underscores.
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
                        onValueChange={field.handleChange}
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
          {backError && (
            <Alert className="mx-auto w-1/2" variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Setup failed</AlertTitle>
              <AlertDescription>{backError}</AlertDescription>
            </Alert>
          )}
          <Field className="justify-end" orientation="horizontal">
            <Button
              onClick={() => {
                form.reset();
                // The theme select previews live, so undo the preview too.
                applyTheme(config.theme, false);
                setBackError(null);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [
                state.canSubmit,
                state.isSubmitting,
                state.isTouched,
              ]}
            >
              {([canSubmit, isSubmitting, isTouched]) => (
                <Button disabled={!(canSubmit && isTouched)} type="submit">
                  {isSubmitting ? "..." : "Save changes"}
                </Button>
              )}
            </form.Subscribe>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
