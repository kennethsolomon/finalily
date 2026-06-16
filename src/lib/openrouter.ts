import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export const DEFAULT_AI_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export interface UserAIConfig {
  ai_provider: string | null;
  ai_api_key: string | null;
  ai_base_url: string | null;
  ai_model_name: string | null;
}

export function isAIConfigured(config?: UserAIConfig | null): boolean {
  if (config?.ai_provider === "custom" && config.ai_api_key) return true;
  return !!process.env.OPENROUTER_API_KEY;
}

export function createAIClient(config?: UserAIConfig | null): OpenAI {
  if (config?.ai_provider === "custom" && config.ai_api_key) {
    return new OpenAI({
      baseURL: config.ai_base_url || "https://api.openai.com/v1",
      apiKey: config.ai_api_key,
    });
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

export function getAIModel(config?: UserAIConfig | null): string {
  if (config?.ai_provider === "custom" && config.ai_model_name) {
    return config.ai_model_name;
  }
  return DEFAULT_AI_MODEL;
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
