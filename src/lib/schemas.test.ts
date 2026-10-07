import { describe, expect, it } from "vitest";
import { preferencesSchema } from "./schemas";

describe("preferencesSchema", () => {
  it("accepts a valid username and theme", () => {
    expect(
      preferencesSchema.safeParse({ username: "neo_42", theme: "dark" }).success
    ).toBe(true);
  });

  it.each([
    "ab",
    "abcdefghijk",
    "with space",
    "dash-ed",
  ])("rejects username %j", (username) => {
    expect(
      preferencesSchema.safeParse({ username, theme: "dark" }).success
    ).toBe(false);
  });
});

describe("preferencesSchema theme", () => {
  it("only accepts the themes the backend knows", () => {
    expect(
      preferencesSchema.safeParse({ username: "neo", theme: "sepia" }).success
    ).toBe(false);
  });
});
