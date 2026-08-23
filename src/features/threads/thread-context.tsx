import type { AgentEvent, Thread, ThreadMessage } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { Channel, invoke } from "@tauri-apps/api/core";
import { useTextBuffer } from "@/hooks/use-text-buffer";

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
   * Refs = état technique du run.
   *
   * Ils ne servent PAS à piloter la navigation.
   */
  const threadIdRef = useRef<string | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const activeRunRef = useRef(false);

  const updateMessages = useCallback(
    (
      updater:
        | ThreadMessage[]
        | ((messages: ThreadMessage[]) => ThreadMessage[]),
    ) => {
      setMessages((previous) =>
        typeof updater === "function" ? updater(previous) : updater,
      );
    },
    [],
  );

  const appendAssistantText = useCallback(
    (text: string) => {
      const messageId = assistantMessageIdRef.current;

      if (!messageId) {
        return;
      }

      updateMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: message.content + text,
              }
            : message,
        ),
      );
    },
    [updateMessages],
  );

  const textBuffer = useTextBuffer({
    onFlush: appendAssistantText,
  });

  const handleError = useCallback(
    (message: string) => {
      textBuffer.stop(true);

      activeRunRef.current = false;

      const messageId = assistantMessageIdRef.current;

      if (messageId) {
        updateMessages((previous) =>
          previous.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  content: item.content
                    ? `${item.content}\n\n⚠️ ${message}`
                    : `⚠️ ${message}`,
                }
              : item,
          ),
        );
      }

      setIsBusy(false);
    },
    [textBuffer, updateMessages],
  );

  const sendMessage = useCallback(
    async (input: string, options?: SendMessageOptions) => {
      const content = input.trim();

      if (!content || activeRunRef.current) {
        return;
      }

      /*
       * Optimistic user message.
       */
      const userMessage: ThreadMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      /*
       * Optimistic assistant message.
       *
       * Les MessageDelta vont remplir celui-ci.
       */
      const assistantMessageId = crypto.randomUUID();

      assistantMessageIdRef.current = assistantMessageId;

      updateMessages((previous) => [
        ...previous,
        userMessage,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ]);

      activeRunRef.current = true;
      setIsBusy(true);

      const channel = new Channel<AgentEvent>();

      channel.onmessage = (event) => {
        switch (event.type) {
          case "ThreadCreated": {
            const newThread = event.data.thread;

            threadIdRef.current = newThread.id;

            setThread(newThread);

            /*
             * Le composant de route décide quoi faire
             * de cet événement.
             *
             * Le provider ne navigue jamais.
             */
            options?.onThreadCreated?.(newThread);

            break;
          }

          case "RunStarted": {
            textBuffer.start();
            break;
          }

          case "MessageDelta": {
            textBuffer.append(event.data.text);
            break;
          }

          case "RunCompleted": {
            textBuffer.stop(true);

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
    [handleError, textBuffer, updateMessages],
  );

  /*
   * Hydrate le provider depuis le loader
   * de /threads/:id.
   */
  const hydrate = useCallback(
    (thread: Thread, threadMessages: ThreadMessage[]) => {
      /*
       * Très important :
       *
       * un loader ne doit jamais écraser
       * un run actuellement en cours.
       */
      if (activeRunRef.current && threadIdRef.current === thread.id) {
        return;
      }

      threadIdRef.current = thread.id;

      setThread(thread);
      setMessages(threadMessages);
    },
    [],
  );

  /*
   * Reset purement local.
   *
   * Pas de navigation.
   */
  const reset = useCallback(() => {
    if (activeRunRef.current) {
      return;
    }

    threadIdRef.current = null;
    assistantMessageIdRef.current = null;

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
    [thread, messages, isBusy, sendMessage, hydrate, reset],
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
