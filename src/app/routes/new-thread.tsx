import { useCallback, useEffect } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { useThread } from "../../features/threads/thread-context";
import { ThreadInput } from "../../features/threads/thread-input";

export function NewThreadPage() {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { isBusy, sendMessage, reset } = useThread();

  useEffect(() => {
    reset();
  }, [reset]);

  const handleSubmit = useCallback(
    (input: string) => {
      void sendMessage(input, {
        onThreadCreated: (thread) => {
          revalidator.revalidate();
          navigate(`/threads/${thread.id}`, {
            replace: true,
          });
        },
      });
    },
    [navigate, sendMessage],
  );
  return (
    <div className="h-full flex items-center justify-center">
      <ThreadInput
        className="my-auto max-w-3xl"
        onSubmit={handleSubmit}
        isBusy={isBusy}
      />
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = NewThreadPage;
