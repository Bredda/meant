import { useCallback, useEffect, useRef } from "react";

const TICK_MS = 30;

type UseTextBufferOptions = {
  onFlush: (text: string) => void;
};

export function useTextBuffer({ onFlush }: UseTextBufferOptions) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCharsToFlush = useCallback((length: number) => {
    if (length > 200) {
      return 30;
    }
    if (length > 100) {
      return 20;
    }
    if (length > 40) {
      return 12;
    }
    if (length > 10) {
      return 6;
    }

    return 2;
  }, []);

  const flush = useCallback(
    (flushAll = false) => {
      if (!bufferRef.current) {
        return;
      }

      const buffer = bufferRef.current;

      const count = flushAll ? buffer.length : getCharsToFlush(buffer.length);

      const text = buffer.slice(0, count);

      bufferRef.current = buffer.slice(count);

      onFlush(text);
    },
    [getCharsToFlush, onFlush]
  );

  const start = useCallback(() => {
    if (timerRef.current !== null) {
      return;
    }

    timerRef.current = setInterval(() => {
      flush();
    }, TICK_MS);
  }, [flush]);

  const stop = useCallback(
    (flushRemaining = true) => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (flushRemaining) {
        flush(true);
      }
    },
    [flush]
  );

  const append = useCallback((text: string) => {
    bufferRef.current += text;
  }, []);

  const clear = useCallback(() => {
    bufferRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    append,
    start,
    stop,
    flush,
    clear,
  };
}
