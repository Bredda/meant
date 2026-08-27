import {
  BotMessageSquareIcon,
  Command,
  Home,
  Settings,
  SidebarIcon,
} from "lucide-react";
import type React from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const HEADER_MENUS: { title: string; to: string; icon: React.ReactNode }[] = [
  {
    title: "Home",
    to: "/",
    icon: <Home />,
  },
  {
    title: "Threads",
    to: "/threads",
    icon: <BotMessageSquareIcon />,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: <Settings />,
  },
];

export function SiteHeader() {
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const handleNavigate = (to: string) => {
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <div className="flex gap-2 px-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Command className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Meant</span>
            <span className="truncate text-muted-foreground text-xs">
              Personnal
            </span>
          </div>
        </div>
        <Separator className="h-4" orientation="vertical" />
        <Button
          className="h-8 w-8"
          onClick={toggleSidebar}
          size="icon"
          variant="ghost"
        >
          <SidebarIcon />
        </Button>
        <Separator className="h-4" orientation="vertical" />
        <div className="flex flex-1 items-center justify-center gap-2">
          {HEADER_MENUS.map((m) => {
            const isActive = location.pathname === m.to;
            return (
              <Tooltip key={m.title}>
                <TooltipTrigger>
                  <Button
                    onClick={() => handleNavigate(m.to)}
                    size="icon"
                    variant={isActive ? "default" : "secondary"}
                  >
                    {m.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </header>
  );
}
