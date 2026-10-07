/** Mirrors `ErrorKind` in src-tauri/src/error.rs. */
export type AppErrorKind =
  | "vault"
  | "config"
  | "db"
  | "provider"
  | "notFound"
  | "invalidInput"
  | "internal";

/** What every Tauri command rejects with (`AppError` in Rust). */
export type AppError = {
  kind: AppErrorKind;
  message: string;
};

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/** A displayable message for anything a command or the JS runtime can throw. */
export function errorMessage(error: unknown): string {
  if (isAppError(error) || error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The kind of a rejection, `internal` when it is not an AppError. */
export function errorKind(error: unknown): AppErrorKind {
  return isAppError(error) ? error.kind : "internal";
}
