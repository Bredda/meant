import { BotMessageSquare, PlusIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import type { Thread } from "@/lib/types";
import { Button } from "../ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

function ThreadsList({ threads }: { threads: Thread[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <>
      {threads.map((t) => {
        const active = pathname === `/threads/${t.id}`;

        return (
          <SidebarMenuButton
            isActive={active}
            key={t.id}
            onClick={() => navigate(`/threads/${t.id}`)}
          >
            {t.title}
          </SidebarMenuButton>
        );
      })}
    </>
  );
}

function EmptyList({
  onNewThread,
}: {
  onNewThread: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BotMessageSquare />
        </EmptyMedia>
        <EmptyTitle>No threads yet</EmptyTitle>
        <EmptyDescription>No data found</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onNewThread}>
          <PlusIcon />
          New thread
        </Button>
      </EmptyContent>
    </Empty>
  );
}

type NavThreadsProps = { threads: Thread[] };

export function NavThreads({ threads }: NavThreadsProps) {
  const navigate = useNavigate();

  const handleNewThread = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();

    navigate("/threads");
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Threads</SidebarGroupLabel>
      <SidebarMenu>
        {threads.length > 0 ? (
          <>
            <SidebarMenuButton onClick={handleNewThread}>
              <PlusIcon /> New thread
            </SidebarMenuButton>
            <ThreadsList threads={threads} />
          </>
        ) : (
          <EmptyList onNewThread={handleNewThread} />
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
