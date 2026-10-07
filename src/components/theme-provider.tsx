import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useUpdateConfig } from "@/hooks/use-config-update";
import { useConfigStore } from "@/stores/config-store";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeProviderState = {
  theme: Theme;
  applyTheme: (theme: Theme, save?: boolean) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  applyTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/** Resolves "system" against the OS preference; the DOM only knows light/dark. */
function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme !== "system") {
    return theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>("system");
  const updateConfig = useUpdateConfig();
  const configTheme = useConfigStore((s) => s.config?.theme);

  const applyTheme = useCallback(
    // `save` is opt-in: forms preview a theme live while the user is still
    // editing, and only persist it on submit.
    async (next: Theme, save = false) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolveTheme(next));

      // "system" is a real, persistable choice — keep it in state and save it
      // rather than short-circuiting once the class has been applied.
      setTheme(next);

      if (save) {
        await updateConfig({ theme: next });
      }
    },
    [updateConfig]
  );

  // Follow the loaded config: bootstrap fills the store after this provider has
  // already mounted, so the initial theme arrives late. Applied without saving,
  // since it is the persisted value we are reading back.
  useEffect(() => {
    applyTheme(configTheme ?? "system", false);
  }, [configTheme, applyTheme]);

  // Keep "system" in sync while the OS preference changes under us.
  useEffect(() => {
    if (theme !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolveTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, applyTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
