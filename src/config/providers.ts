// ---------------------------------------------------------------------------
// Config providers
// ---------------------------------------------------------------------------

import { RiAnthropicFill, RiOpenaiFill } from "@remixicon/react";

export type ProviderId = "anthropic" | "openai";

export interface ProviderConfig {
  icon: React.ComponentType<{ className?: string }>;
  id: ProviderId;
  keyPrefix: string;
  name: string;
  placeholder: string;
  validateKey: (key: string) => boolean;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    icon: RiAnthropicFill,
    keyPrefix: "sk-ant-",
    placeholder: "sk-ant-...",
    validateKey: (key) => key.startsWith("sk-ant-"),
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: RiOpenaiFill,
    keyPrefix: "sk-",
    placeholder: "sk-...",
    // Anthropic key should not pass OpenAI validation
    validateKey: (key) => key.startsWith("sk-") && !key.startsWith("sk-ant-"),
  },
];

export const PROVIDER_MAP = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p])
) as Record<ProviderId, ProviderConfig>;
