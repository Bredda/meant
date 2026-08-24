import { useCallback, useEffect } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { ThreadInput } from "../../features/threads/components/thread-input";
import { useThread } from "../../features/threads/thread-context";

export function NewThreadPage() {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { isBusy, sendMessage, reset } = useThread();

  useEffect(() => {
    reset();
  }, [reset]);

  const handleSubmit = useCallback(
    (input: string) => {
      sendMessage(input, {
        onThreadCreated: (thread) => {
          revalidator.revalidate();
          navigate(`/threads/${thread.id}`, {
            replace: true,
          });
        },
      });
    },
    [navigate, sendMessage, revalidator.revalidate]
  );
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <ThreadInput
        className="my-auto max-w-3xl"
        isBusy={isBusy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = NewThreadPage;
