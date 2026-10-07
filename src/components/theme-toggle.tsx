import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "@/components/theme-provider";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ThemeSelectProps = {
  className?: string;
};

export function ThemeSelect({ className }: ThemeSelectProps) {
  const { applyTheme, theme } = useTheme();

  return (
    <Select onValueChange={(t) => applyTheme(t as Theme, true)} value={theme}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="light">
            <Sun />
            Light
          </SelectItem>
          <SelectItem value="dark">
            <Moon />
            Dark
          </SelectItem>
          <SelectItem value="system">
            <Monitor />
            System
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
