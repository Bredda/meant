export type AgentEvent =
  | {
      type: "ThreadCreated";
      data: {
        thread: Thread;
      };
    }
  | {
      type: "RunStarted";
      data: {
        thread_id: string;
      };
    }
  | {
      type: "MessageDelta";
      data: {
        thread_id: string;
        text: string;
      };
    }
  | {
      type: "RunCompleted";
      data: {
        thread_id: string;
      };
    }
  | {
      type: "Error";
      data: {
        thread_id?: string;
        message: string;
      };
    };

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};
