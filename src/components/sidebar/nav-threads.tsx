import {
  BotMessageSquare,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { filterThreads } from "@/features/threads/utils";
import { useThreadActions } from "@/hooks/use-thread-actions";
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

type ThreadRowProps = {
  thread: Thread;
  active: boolean;
  renaming: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onRename: (title: string) => void;
  onAskDelete: () => void;
};

function ThreadRow({
  thread,
  active,
  renaming,
  onOpen,
  onStartRename,
  onCancelRename,
  onRename,
  onAskDelete,
}: ThreadRowProps) {
  const [draft, setDraft] = useState(thread.title);

  if (renaming) {
    const commit = () => {
      const title = draft.trim();
      if (title && title !== thread.title) {
        onRename(title);
      } else {
        onCancelRename();
      }
    };

    return (
      <SidebarMenuItem>
        <Input
          aria-label="Thread title"
          autoFocus
          className="h-8"
          onBlur={onCancelRename}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelRename();
            }
          }}
          value={draft}
        />
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} onClick={onOpen}>
        {thread.title}
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontalIcon />
            <span className="sr-only">Thread actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        {/* Keeps focus where the rename input just took it. */}
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
          side="right"
        >
          <DropdownMenuItem
            onSelect={() => {
              setDraft(thread.title);
              onStartRename();
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAskDelete} variant="destructive">
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function ThreadsList({ threads }: { threads: Thread[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { renameThread, deleteThread } = useThreadActions();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Thread | null>(null);

  const handleRename = async (threadId: string, title: string) => {
    // Stays in edit mode when the backend rejects the title.
    if (await renameThread(threadId, title)) {
      setRenamingId(null);
    }
  };

  return (
    <>
      {threads.map((t) => (
        <ThreadRow
          active={pathname === `/threads/${t.id}`}
          key={t.id}
          onAskDelete={() => setPendingDelete(t)}
          onCancelRename={() => setRenamingId(null)}
          onOpen={() => navigate(`/threads/${t.id}`)}
          onRename={(title) => handleRename(t.id, title)}
          onStartRename={() => setRenamingId(t.id)}
          renaming={renamingId === t.id}
          thread={t}
        />
      ))}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” and all its messages will be removed from
              this computer. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  deleteThread(pendingDelete.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [query, setQuery] = useState("");
  const matching = filterThreads(threads, query);

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
            <Input
              aria-label="Search threads"
              className="my-1 h-8"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads"
              type="search"
              value={query}
            />
            {matching.length > 0 ? (
              <ThreadsList threads={matching} />
            ) : (
              <p className="px-2 py-1.5 text-muted-foreground text-sm">
                No matching thread
              </p>
            )}
          </>
        ) : (
          <EmptyList onNewThread={handleNewThread} />
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
