import type React from "react";

import { NavThreads } from "@/components/sidebar/nav-threads";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import type { Thread } from "@/lib/types";

type AppSidebarProps = { threads: Thread[] } & React.ComponentProps<
  typeof Sidebar
>;

export function AppSidebar({ threads, ...props }: AppSidebarProps) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarContent>
        <NavThreads threads={threads} />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
