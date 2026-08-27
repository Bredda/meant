import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppErrorPage from "@/features/errors/app-error";
import { useConfigStore } from "@/stores/config-store";

export default function AppProvider({ children }: { children: ReactNode }) {
  const userTheme = useConfigStore((s) => s.config?.theme);
  return (
    <ThemeProvider
      defaultTheme={userTheme || "dark"}
      storageKey="vite-ui-theme"
    >
      <Suspense fallback={<>Loading...</>}>
        <ErrorBoundary FallbackComponent={AppErrorPage}>
          <TooltipProvider>{children}</TooltipProvider>
        </ErrorBoundary>
      </Suspense>
    </ThemeProvider>
  );
}
