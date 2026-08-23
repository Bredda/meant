import { AppSidebar } from "./sidebar/app-sidebar";
import { SiteHeader } from "./sidebar/site-header";
import { SidebarProvider, SidebarInset } from "./ui/sidebar";
import { Outlet, useLoaderData } from "react-router";

import { Thread } from "@/lib/types";
import { ThreadProvider } from "@/features/threads/thread-context";
export function AppLayout() {
  const threads = useLoaderData<Thread[]>();
  return (
    <ThreadProvider>
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar threads={threads} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThreadProvider>
  );
}
