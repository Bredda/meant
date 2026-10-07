import z from "zod";

export const preferencesSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(10, "Username must be at most 10 characters.")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores."
    ),
  theme: z.string(),
});

export type PreferencesValues = z.infer<typeof preferencesSchema>;
