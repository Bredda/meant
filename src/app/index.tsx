import "./global.css";

import AppProvider from "@/app/provider";
import AppRouter from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/features/splashscreen/splash-screen";
import { useBootstrap } from "@/hooks/use-bootstrap";

export default function App() {
  const { state, complete } = useBootstrap();

  return (
    <div className="h-full [--header-height:calc(--spacing(14))]">
      <AppProvider>
        {state.step === "done" ? (
          <AppRouter />
        ) : (
          <div className="flex h-screen flex-col items-center justify-center gap-6">
            <div className="text-6xl">Meant</div>
            <SplashScreen onComplete={complete} state={state} />
          </div>
        )}
        <Toaster richColors />
      </AppProvider>
    </div>
  );
}
