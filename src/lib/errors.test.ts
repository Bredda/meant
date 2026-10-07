import { describe, expect, it } from "vitest";
import { errorKind, errorMessage, isAppError } from "./errors";

describe("errors", () => {
  it("reads kind and message from a command rejection", () => {
    const rejection = { kind: "provider", message: "No key" };

    expect(isAppError(rejection)).toBe(true);
    expect(errorMessage(rejection)).toBe("No key");
    expect(errorKind(rejection)).toBe("provider");
  });

  it("falls back for JS errors and strings", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorKind("plain")).toBe("internal");
  });
});
