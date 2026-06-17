import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// Primary model used with OpenRouter
export const DEFAULT_AI_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

// LM Studio local fallback — configurable via env, defaults to the local server
const LM_STUDIO_BASE_URL = process.env.LM_STUDIO_BASE_URL ?? "http://192.168.1.28:1234/v1";
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL ?? "qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2";

export interface UserAIConfig {
  ai_provider: string | null;
  ai_api_key: string | null;
  ai_base_url: string | null;
  ai_model_name: string | null;
}

export function isAIConfigured(config?: UserAIConfig | null): boolean {
  if (config?.ai_provider === "custom" && config.ai_api_key) return true;
  if (process.env.OPENROUTER_API_KEY) return true;
  // LM Studio is always available as local fallback — no API key needed
  return true;
}

export function createAIClient(config?: UserAIConfig | null): OpenAI {
  // 1. User-configured custom provider (e.g. their own OpenAI key)
  if (config?.ai_provider === "custom" && config.ai_api_key) {
    return new OpenAI({
      baseURL: config.ai_base_url || "https://api.openai.com/v1",
      apiKey: config.ai_api_key,
    });
  }

  // 2. OpenRouter (primary — requires OPENROUTER_API_KEY)
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  // 3. LM Studio local fallback — no key required
  return new OpenAI({
    baseURL: LM_STUDIO_BASE_URL,
    apiKey: "lm-studio",
  });
}

export function getAIModel(config?: UserAIConfig | null): string {
  if (config?.ai_provider === "custom" && config.ai_model_name) {
    return config.ai_model_name;
  }
  if (process.env.OPENROUTER_API_KEY) {
    return DEFAULT_AI_MODEL;
  }
  return LM_STUDIO_MODEL;
}

export async function fetchUserAIConfig(userId: string): Promise<UserAIConfig | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiProvider: true, aiApiKey: true, aiBaseUrl: true, aiModelName: true },
  });
  if (!user) return null;
  return {
    ai_provider: user.aiProvider,
    ai_api_key: user.aiApiKey,
    ai_base_url: user.aiBaseUrl,
    ai_model_name: user.aiModelName,
  };
}

export function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
