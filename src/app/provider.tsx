import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppErrorPage from "@/features/errors/app-error";

export default function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider storageKey="vite-ui-theme">
      <Suspense fallback={<>Loading...</>}>
        <ErrorBoundary FallbackComponent={AppErrorPage}>
          <TooltipProvider>{children}</TooltipProvider>
        </ErrorBoundary>
      </Suspense>
    </ThemeProvider>
  );
}
