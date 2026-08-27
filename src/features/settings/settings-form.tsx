import { ThemeSelect } from "@/components/theme-toggle";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

export function SettingsForm() {
  return (
    <FieldSet>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Theme</FieldLabel>
          <ThemeSelect className="max-w-[180px]" />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
