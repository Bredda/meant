import { Channel, invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTextBuffer } from "@/hooks/use-text-buffer";
import type { AgentEvent, Thread, ThreadMessage } from "@/lib/types";
import { isRunDisplayed, type RunAction, runReducer } from "./run-reducer";
import { getThread } from "./thread-loader";

type SendMessageOptions = {
  onThreadCreated?: (thread: Thread) => void;
};

type ThreadContextValue = {
  thread: Thread | null;
  messages: ThreadMessage[];
  isBusy: boolean;

  sendMessage: (input: string, options?: SendMessageOptions) => Promise<void>;

  hydrate: (thread: Thread, messages: ThreadMessage[]) => void;

  reset: () => void;
};

const ThreadContext = createContext<ThreadContextValue | null>(null);

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const [thread, setThread] = useState<Thread | null>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const [isBusy, setIsBusy] = useState(false);

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
    setIsBusy(false);
  }, []);

  const handleError = useCallback(
    (message: string, runThreadId: string | null) => {
      textBuffer.stop(true);

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
          thread_id: runThreadId ?? "",
        },
      });

      endRun();

      if (!runThreadId) {
        return;
      }
      getThread(runThreadId)
        .then(({ messages: persisted }) => {
          // Skip if the user moved on or already started another run.
          if (
            activeRunRef.current ||
            !isRunDisplayed(runThreadId, threadIdRef.current)
          ) {
            return;
          }
          dispatch({ type: "reloadAfterFailure", persisted, warningId });
        })
        .catch((error: unknown) => {
          console.error("Could not reload thread after a failed run", error);
        });
    },
    [dispatch, endRun, textBuffer]
  );

  const sendMessage = useCallback(
    async (input: string, options?: SendMessageOptions) => {
      const content = input.trim();

      if (!content || activeRunRef.current) {
        return;
      }

      /**
       * Snapshot taken BEFORE any optimistic update:
       * this is the basis on which we build final state when RunCompleted
       */
      preRunMessagesRef.current = messages;
      livePositionRef.current = messages.length;
      currentAssistantMessageIdRef.current = null;

      // The thread this run belongs to, whatever the user opens meanwhile.
      let runThreadId = threadIdRef.current;

      // Optimistic user message
      dispatch({
        type: "append",
        message: {
          id: crypto.randomUUID(),
          role: "user",
          content,
          position: livePositionRef.current++,
          thread_id: runThreadId ?? "",
        },
      });

      activeRunRef.current = true;
      setIsBusy(true);

      const channel = new Channel<AgentEvent>();

      channel.onmessage = (event) => {
        console.debug("Received Thread event", event);

        const displayed = isRunDisplayed(runThreadId, threadIdRef.current);

        if (event.type === "ThreadCreated") {
          runThreadId = event.data.thread.id;
        }

        if (!displayed) {
          // The user opened another thread: keep only the run lifecycle, the
          // persisted result shows up when they come back to this thread.
          textBuffer.stop(false);
          textBuffer.clear();
          currentAssistantMessageIdRef.current = null;
          if (event.type === "RunCompleted" || event.type === "Error") {
            endRun();
          }
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
            const { message_id } = event.data;

            currentAssistantMessageIdRef.current = message_id;

            dispatch({
              type: "append",
              message: {
                id: message_id,
                role: "assistant",
                content: "",
                position: livePositionRef.current++,
                thread_id: runThreadId ?? "",
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
            const { tool_call_id, tool_name, arguments: args } = event.data;

            dispatch({
              type: "append",
              message: {
                id: tool_call_id,
                role: "tool_call",
                tool_call_id,
                tool_name,
                content: args,
                position: livePositionRef.current++,
                thread_id: runThreadId ?? "",
              },
            });

            break;
          }

          case "ToolCallCompleted": {
            const {
              tool_call_id,
              tool_name,
              content: toolContent,
            } = event.data;

            dispatch({
              type: "append",
              message: {
                id: `${tool_call_id}:result`,
                role: "tool_result",
                tool_call_id,
                tool_name,
                content: toolContent,
                position: livePositionRef.current++,
                thread_id: runThreadId ?? "",
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

            endRun();

            break;
          }

          case "Error": {
            handleError(event.data.message, runThreadId);
            break;
          }

          default:
            console.warn("Unknown agent event", event);
        }
      };

      try {
        await invoke("chat", {
          request: {
            threadId: runThreadId,
            input: content,
          },
          channel,
        });
      } catch (error) {
        // A run failure arrives twice: as an Error event, then as this
        // rejection. Only failures before the run started (no provider,
        // unknown thread) have no event, and the run is still active then.
        if (!activeRunRef.current) {
          return;
        }
        if (!isRunDisplayed(runThreadId, threadIdRef.current)) {
          endRun();
          return;
        }
        handleError(
          error instanceof Error ? error.message : String(error),
          runThreadId
        );
      }
    },
    [dispatch, endRun, handleError, messages, textBuffer]
  );

  //Hydrates provider from /threads/:id loader.
  const hydrate = useCallback(
    (thread: Thread, threadMessages: ThreadMessage[]) => {
      //IMPORTANT : loader MUST NEVER overwrite a pending run.
      if (activeRunRef.current && threadIdRef.current === thread.id) {
        return;
      }

      threadIdRef.current = thread.id;

      setThread(thread);
      setMessages(threadMessages);
    },
    []
  );

  // Local reset. No navigation
  const reset = useCallback(() => {
    threadIdRef.current = null;
    setThread(null);
    setMessages([]);

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
      isBusy,
      sendMessage,
      hydrate,
      reset,
    }),
    [thread, messages, isBusy, sendMessage, hydrate, reset]
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
