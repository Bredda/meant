import { Outlet, useLoaderData } from "react-router";
import { ThreadProvider } from "@/features/threads/thread-context";
import { useThreadTitleUpdates } from "@/hooks/use-thread-title-updates";
import type { Thread } from "@/lib/types";
import { AppSidebar } from "./sidebar/app-sidebar";
import { SiteHeader } from "./sidebar/site-header";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";

export function AppLayout() {
  useThreadTitleUpdates();
  const threads = useLoaderData<Thread[]>();
  return (
    <ThreadProvider>
      <SidebarProvider className="flex h-full flex-col">
        <SiteHeader />
        <div className="flex min-h-0 flex-1">
          <AppSidebar threads={threads} />
          <SidebarInset>
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThreadProvider>
  );
}
