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

  const updateMessages = useCallback(
    (
      updater:
        | ThreadMessage[]
        | ((messages: ThreadMessage[]) => ThreadMessage[])
    ) => {
      setMessages((previous) =>
        typeof updater === "function" ? updater(previous) : updater
      );
    },
    []
  );

  const appendMessage = useCallback(
    (message: ThreadMessage) => {
      updateMessages((previous) => [...previous, message]);
    },
    [updateMessages]
  );

  const appendAssistantText = useCallback(
    (text: string) => {
      const messageId = currentAssistantMessageIdRef.current;

      if (!messageId) {
        return;
      }

      updateMessages((previous) =>
        previous.map((item) => {
          if (item.id !== messageId || item.role !== "assistant") {
            return item;
          }

          return {
            ...item,
            content: item.content + text,
          };
        })
      );
    },
    [updateMessages]
  );

  const textBuffer = useTextBuffer({
    onFlush: appendAssistantText,
  });

  const handleError = useCallback(
    (message: string) => {
      textBuffer.stop(true);

      activeRunRef.current = false;

      const messageId = currentAssistantMessageIdRef.current;

      if (messageId) {
        updateMessages((previous) =>
          previous.map((item) => {
            if (item.id !== messageId || item.role !== "assistant") {
              return item;
            }

            return {
              ...item,
              content: item.content
                ? `${item.content}\n\n⚠️ ${message}`
                : `⚠️ ${message}`,
            };
          })
        );
      } else {
        /**
         * Error occured outside test segment
         * (eg. while exeuting tool call)
         * so we push a specific assistant message
         */
        appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${message}`,
          position: livePositionRef.current++,
          thread_id: threadIdRef.current ?? "",
        });
      }

      currentAssistantMessageIdRef.current = null;
      setIsBusy(false);
    },
    [appendMessage, textBuffer, updateMessages]
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

      // Optimistic user message
      const userMessage: ThreadMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        position: livePositionRef.current++,
        thread_id: threadIdRef.current ?? "",
      };

      updateMessages((previous) => [...previous, userMessage]);

      activeRunRef.current = true;
      setIsBusy(true);

      const channel = new Channel<AgentEvent>();

      channel.onmessage = (event) => {
        console.debug("Received Thread event", event);
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

            appendMessage({
              id: message_id,
              role: "assistant",
              content: "",
              position: livePositionRef.current++,
              thread_id: threadIdRef.current ?? "",
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

            appendMessage({
              id: tool_call_id,
              role: "tool_call",
              tool_call_id,
              tool_name,
              arguments: args,
              position: livePositionRef.current++,
              thread_id: threadIdRef.current ?? "",
            });

            break;
          }

          case "ToolCallCompleted": {
            const {
              tool_call_id,
              tool_name,
              content: toolContent,
            } = event.data;

            appendMessage({
              id: `${tool_call_id}:result`,
              role: "tool_result",
              tool_call_id,
              tool_name,
              content: toolContent,
              position: livePositionRef.current++,
              thread_id: threadIdRef.current ?? "",
            });

            break;
          }

          case "RunCompleted": {
            textBuffer.stop(true);

            /*
             * Updating : RunCompleted returned messages
             * are truth (stable DB ids). Live state is discarded.
             */
            setMessages([...preRunMessagesRef.current, ...event.data.messages]);

            currentAssistantMessageIdRef.current = null;
            activeRunRef.current = false;
            setIsBusy(false);

            break;
          }

          case "Error": {
            handleError(event.data.message);
            break;
          }

          default:
            console.warn("Unknown agent event", event);
        }
      };

      try {
        await invoke("chat", {
          request: {
            threadId: threadIdRef.current,
            input: content,
          },
          channel,
        });
      } catch (error) {
        handleError(error instanceof Error ? error.message : String(error));
      }
    },
    [appendMessage, handleError, messages, textBuffer, updateMessages]
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
    if (activeRunRef.current) {
      return;
    }

    threadIdRef.current = null;
    currentAssistantMessageIdRef.current = null;
    preRunMessagesRef.current = [];

    setThread(null);
    setMessages([]);
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
