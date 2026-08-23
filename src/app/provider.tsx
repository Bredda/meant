import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppErrorPage from "@/features/errors/app-error";
import { ThemeProvider } from "@/components/theme-provider";

export default function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Suspense fallback={<>Loading...</>}>
        <ErrorBoundary FallbackComponent={AppErrorPage}>
          <TooltipProvider>{children}</TooltipProvider>
        </ErrorBoundary>
      </Suspense>
    </ThemeProvider>
  );
}
