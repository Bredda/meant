import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsForm } from "@/features/settings/settings-form";

export function SettingsPage() {
  return (
    <div className="h-full min-h-0">
      <Card className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-0">
        <CardHeader className="gap-1 border-b">
          <CardTitle>Settings</CardTitle>
          <CardDescription>Lorem ipsuem settings</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-12">
          <SettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = SettingsPage;
