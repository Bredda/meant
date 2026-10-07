import { Channel, invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { useTextBuffer } from "@/hooks/use-text-buffer";
import { type AppErrorKind, errorKind, errorMessage } from "@/lib/errors";
import type {
  AgentEvent,
  RunSummary,
  Thread,
  ThreadMessage,
} from "@/lib/types";
import {
  isRunDisplayed,
  messagesThroughLastUser,
  type RunAction,
  runReducer,
} from "./run-reducer";
import { getThread } from "./thread-loader";

type SendMessageOptions = {
  onThreadCreated?: (thread: Thread) => void;
};

/** What `startRun` needs to begin a run. */
type StartRun = {
  command: "chat" | "regenerate";
  /** The displayed messages the run builds on; `RunCompleted` follows them. */
  snapshot: ThreadMessage[];
  /** The typed message of a `chat` run, shown at once; absent to regenerate. */
  content?: string;
  options?: SendMessageOptions;
};

type ThreadContextValue = {
  thread: Thread | null;
  messages: ThreadMessage[];
  /** The thread's persisted runs, for the notices of failed or stopped ones. */
  runs: RunSummary[];
  isBusy: boolean;
  /** Stops the running response; `null` until the run is known to the backend. */
  cancelRun: (() => void) | null;

  sendMessage: (input: string, options?: SendMessageOptions) => Promise<void>;
  /** Answers the last user message again, replacing the previous answer. */
  regenerate: () => Promise<void>;

  hydrate: (
    thread: Thread,
    messages: ThreadMessage[],
    runs: RunSummary[]
  ) => void;

  reset: () => void;
};

const ThreadContext = createContext<ThreadContextValue | null>(null);

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const [thread, setThread] = useState<Thread | null>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  // Read by sendMessage, so it is not recreated on every streamed flush.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [runs, setRuns] = useState<RunSummary[]>([]);

  const [isBusy, setIsBusy] = useState(false);
  // Known from the run's first event; what `cancel_run` needs.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Refreshes route loaders (the sidebar list is ordered by last activity).
  const { revalidate } = useRevalidator();
  const navigate = useNavigate();

  /*
   * Refs = run technical state.
   *
   * DO NOT use it for navigation purpose.
   */
  // Thread currently displayed (set by hydrate/reset and by ThreadCreated).
  const threadIdRef = useRef<string | null>(null);
  const activeRunRef = useRef(false);

  /*
   * Assistant text segment currently streaming.
   *
   * Changes on every MessageStarted (one run can produce
   * multiple segments : text -> tool call -> text...).
   * null there is no open segment (eg. during a tool call).
   */
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  /*
   * Messages snapshot des messages just before run (before adding
   * optimistic user message). RunCompleted returns updated list
   * et is the source of truth for the run messages (including user one),
   * so build final state is simply :
   *
   *   [...snapshot, ...event.data.messages]
   *
   * No id matching required, especially for tool calls/results.
   */
  const preRunMessagesRef = useRef<ThreadMessage[]>([]);

  // Message carrying the live failure warning of the last failed run.
  const failureWarningIdRef = useRef<string | null>(null);

  /*
   * Monotonic local position for optimistic messages.
   * Purely cosmétic : this values are replaced
   * by position from DB as soon as RunCompleted is received.
   */
  const livePositionRef = useRef(0);

  const dispatch = useCallback((action: RunAction) => {
    setMessages((previous) => runReducer(previous, action));
  }, []);

  const appendAssistantText = useCallback(
    (text: string) => {
      const messageId = currentAssistantMessageIdRef.current;

      if (!messageId) {
        return;
      }

      dispatch({ type: "appendText", messageId, text });
    },
    [dispatch]
  );

  const textBuffer = useTextBuffer({
    onFlush: appendAssistantText,
  });

  /** Ends the active run without touching the displayed messages. */
  const endRun = useCallback(() => {
    activeRunRef.current = false;
    currentAssistantMessageIdRef.current = null;
    setActiveRunId(null);
    setIsBusy(false);
  }, []);

  const cancelRun = useCallback(() => {
    if (!activeRunId) {
      return;
    }
    // The run ends through its own RunCompleted event (status `cancelled`).
    invoke("cancel_run", { runId: activeRunId }).catch((error: unknown) => {
      toast.error("Could not stop the response", {
        description: errorMessage(error),
      });
    });
  }, [activeRunId]);

  const handleError = useCallback(
    (message: string, runThreadId: string | null, kind: AppErrorKind) => {
      textBuffer.stop(true);

      if (kind === "provider") {
        // Only the user's click navigates: the provider itself never does.
        toast.error("The AI provider could not answer", {
          description: "Check your API key in Settings.",
          action: {
            label: "Open Settings",
            onClick: () => navigate("/settings"),
          },
        });
      }

      const fallbackId = crypto.randomUUID();
      const warningId = currentAssistantMessageIdRef.current ?? fallbackId;

      dispatch({
        type: "fail",
        messageId: currentAssistantMessageIdRef.current,
        warning: message,
        fallback: {
          id: fallbackId,
          role: "assistant",
          content: `⚠️ ${message}`,
          position: livePositionRef.current++,
          threadId: runThreadId ?? "",
        },
      });

      failureWarningIdRef.current = warningId;
      endRun();
    },
    [dispatch, endRun, navigate, textBuffer]
  );

  /**
   * Shows the failed run as the database has it. Called once `invoke` has
   * settled, not on the `Error` event: the run row is closed (`failed`) only
   * after the event, so reading sooner would find it still `running`.
   */
  const reloadAfterFailure = useCallback(
    (runThreadId: string | null, runId: string | null) => {
      const warningId = failureWarningIdRef.current;
      failureWarningIdRef.current = null;
      if (!(runThreadId && warningId)) {
        return;
      }

      getThread(runThreadId)
        .then(({ messages: persisted, runs: persistedRuns }) => {
          // Skip if the user moved on or already started another run.
          if (
            activeRunRef.current ||
            !isRunDisplayed(runThreadId, threadIdRef.current)
          ) {
            return;
          }
          setRuns(persistedRuns);
          dispatch({
            type: "reloadAfterFailure",
            persisted,
            warningId,
            // No run row (failure before the run was recorded): nothing else
            // would show the error, so the live warning stays.
            keepWarning: !persistedRuns.some((run) => run.id === runId),
          });
        })
        .catch((error: unknown) => {
          console.error("Could not reload thread after a failed run", error);
        });
    },
    [dispatch]
  );

  /**
   * The user opened another thread: keep only the run lifecycle, the
   * persisted result shows up when they come back to this thread.
   */
  const handleHiddenRunEvent = useCallback(
    (event: AgentEvent) => {
      textBuffer.stop(false);
      textBuffer.clear();
      currentAssistantMessageIdRef.current = null;
      if (event.type === "RunCompleted" || event.type === "Error") {
        endRun();
      }
    },
    [endRun, textBuffer]
  );

  /**
   * Runs the `chat` or `regenerate` command and renders it as it streams.
   * Both end the same way: `RunCompleted` carries the persisted messages that
   * follow `snapshot`.
   */
  const startRun = useCallback(
    async ({ command, snapshot, content, options }: StartRun) => {
      /**
       * Snapshot taken BEFORE any optimistic update:
       * this is the basis on which we build final state when RunCompleted
       */
      preRunMessagesRef.current = snapshot;
      livePositionRef.current = snapshot.length;
      currentAssistantMessageIdRef.current = null;

      // The thread this run belongs to, whatever the user opens meanwhile.
      let runThreadId = threadIdRef.current;
      // Known from the first event; tells the reload which run row to expect.
      let runId: string | null = null;

      if (content === undefined) {
        // Regenerating: the answer being replaced leaves the screen now.
        setMessages(snapshot);
      } else {
        // Optimistic user message
        dispatch({
          type: "append",
          message: {
            id: crypto.randomUUID(),
            role: "user",
            content,
            position: livePositionRef.current++,
            threadId: runThreadId ?? "",
          },
        });
      }

      activeRunRef.current = true;
      setIsBusy(true);

      const channel = new Channel<AgentEvent>();

      channel.onmessage = (event) => {
        runId = event.data.runId;
        if (event.type !== "RunCompleted" && event.type !== "Error") {
          setActiveRunId(runId);
        }
        const displayed = isRunDisplayed(runThreadId, threadIdRef.current);

        if (event.type === "ThreadCreated") {
          runThreadId = event.data.thread.id;
        }

        if (!displayed) {
          handleHiddenRunEvent(event);
          return;
        }

        switch (event.type) {
          case "ThreadCreated": {
            const newThread = event.data.thread;

            threadIdRef.current = newThread.id;

            setThread(newThread);

            /*
             * Routing component decide on what to do.
             * No navigation from the provider
             */
            options?.onThreadCreated?.(newThread);

            break;
          }

          case "RunStarted": {
            break;
          }

          case "MessageStarted": {
            const { messageId } = event.data;

            currentAssistantMessageIdRef.current = messageId;

            dispatch({
              type: "append",
              message: {
                id: messageId,
                role: "assistant",
                content: "",
                position: livePositionRef.current++,
                threadId: runThreadId ?? "",
              },
            });

            textBuffer.start();

            break;
          }

          case "MessageDelta": {
            textBuffer.append(event.data.text);
            break;
          }

          case "MessageCompleted": {
            /*
             * Flush + stop : gracefuly close this segment before
             * any new text segment or tool call is received.
             */
            textBuffer.stop(true);
            currentAssistantMessageIdRef.current = null;
            break;
          }

          case "ToolCallStarted": {
            const { toolCallId, toolName, arguments: args } = event.data;

            dispatch({
              type: "append",
              message: {
                id: toolCallId,
                role: "tool_call",
                toolCallId,
                toolName,
                content: args,
                position: livePositionRef.current++,
                threadId: runThreadId ?? "",
              },
            });

            break;
          }

          case "ToolCallCompleted": {
            const {
              toolCallId,
              toolName,
              content: toolContent,
              isError,
            } = event.data;

            dispatch({
              type: "append",
              message: {
                id: `${toolCallId}:result`,
                role: "tool_result",
                toolCallId,
                toolName,
                content: toolContent,
                isError,
                position: livePositionRef.current++,
                threadId: runThreadId ?? "",
              },
            });

            break;
          }

          case "RunCompleted": {
            textBuffer.stop(true);

            /*
             * Updating : RunCompleted returned messages
             * are truth (stable DB ids). Live state is discarded.
             */
            dispatch({
              type: "complete",
              snapshot: preRunMessagesRef.current,
              persisted: event.data.messages,
            });

            // Route data is refreshed once `chat` resolves: the run row is
            // closed after this event, so refreshing now would read it
            // still `running`.
            endRun();

            break;
          }

          case "Error": {
            handleError(event.data.message, runThreadId, event.data.kind);
            break;
          }

          default:
            console.warn("Unknown agent event", event);
        }
      };

      try {
        await invoke(command, {
          request: { threadId: runThreadId, input: content },
          channel,
        });
        // Sidebar order, thread title and run notices, now the run is closed.
        revalidate();
      } catch (error) {
        // A run failure arrives twice: as an Error event, then as this
        // rejection. Only failures before the run started (no provider,
        // unknown thread) have no event, and the run is still active then.
        if (activeRunRef.current) {
          if (!isRunDisplayed(runThreadId, threadIdRef.current)) {
            endRun();
            return;
          }
          handleError(errorMessage(error), runThreadId, errorKind(error));
        }

        // The run row is closed by now, whichever of the two reported it.
        reloadAfterFailure(runThreadId, runId);
      }
    },
    [
      dispatch,
      endRun,
      handleError,
      handleHiddenRunEvent,
      reloadAfterFailure,
      revalidate,
      textBuffer,
    ]
  );

  const sendMessage = useCallback(
    async (input: string, options?: SendMessageOptions) => {
      const content = input.trim();

      if (!content || activeRunRef.current) {
        return;
      }

      await startRun({
        command: "chat",
        snapshot: messagesRef.current,
        content,
        options,
      });
    },
    [startRun]
  );

  const regenerate = useCallback(async () => {
    const snapshot = messagesThroughLastUser(messagesRef.current);

    if (!(threadIdRef.current && snapshot) || activeRunRef.current) {
      return;
    }

    await startRun({ command: "regenerate", snapshot });
  }, [startRun]);

  //Hydrates provider from /threads/:id loader.
  const hydrate = useCallback(
    (
      thread: Thread,
      threadMessages: ThreadMessage[],
      threadRuns: RunSummary[]
    ) => {
      //IMPORTANT : loader MUST NEVER overwrite a pending run.
      if (activeRunRef.current && threadIdRef.current === thread.id) {
        return;
      }

      threadIdRef.current = thread.id;

      setThread(thread);
      setMessages(threadMessages);
      setRuns(threadRuns);
    },
    []
  );

  // Local reset. No navigation
  const reset = useCallback(() => {
    threadIdRef.current = null;
    setThread(null);
    setMessages([]);
    setRuns([]);

    // A run still streaming keeps its own state: its events stop touching
    // the display (isRunDisplayed) and it ends on RunCompleted or Error.
    if (activeRunRef.current) {
      return;
    }

    currentAssistantMessageIdRef.current = null;
    preRunMessagesRef.current = [];
    setIsBusy(false);
  }, []);

  const value = useMemo(
    () => ({
      thread,
      messages,
      runs,
      isBusy,
      cancelRun: activeRunId ? cancelRun : null,
      sendMessage,
      regenerate,
      hydrate,
      reset,
    }),
    [
      thread,
      messages,
      runs,
      isBusy,
      activeRunId,
      cancelRun,
      sendMessage,
      regenerate,
      hydrate,
      reset,
    ]
  );

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThread() {
  const context = useContext(ThreadContext);

  if (!context) {
    throw new Error("useThread must be used inside ThreadProvider");
  }

  return context;
}
