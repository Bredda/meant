import { Thread } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await invoke<Thread[]>("list_threads");

      setThreads(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const selectThread = useCallback((id: string) => {
    setThreadId(id);
  }, []);

  const createThread = useCallback(() => {
    setThreadId(null);
  }, []);

  return {
    threads,
    threadId,
    isLoading,

    selectThread,
    createThread,

    refresh: loadThreads,
  };
}
