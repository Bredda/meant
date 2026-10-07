import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldSeparator } from "@/components/ui/field";
import { PreferencesForm } from "@/features/settings/preferences";
import { ProvidersForm } from "@/features/settings/providers";

export function SettingsPage() {
  return (
    <div className="h-full min-h-0">
      <Card className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-0">
        <CardHeader className="gap-1 border-b">
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Preferences are stored locally in config.toml. API keys are stored
            in your OS vault.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-8 overflow-y-auto p-12">
          <PreferencesForm />
          <FieldSeparator className="mb-2" />
          <ProvidersForm />
        </CardContent>
      </Card>
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = SettingsPage;
