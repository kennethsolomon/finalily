"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { maskApiKey } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export interface AIConfigResponse {
  provider: string | null;
  baseUrl: string | null;
  modelName: string | null;
  hasApiKey: boolean;
  maskedApiKey: string | null;
}

export async function getAIConfig(): Promise<AIConfigResponse> {
  const { user } = await getAuthUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProvider: true, aiApiKey: true, aiBaseUrl: true, aiModelName: true },
  });

  if (!dbUser) {
    return { provider: null, baseUrl: null, modelName: null, hasApiKey: false, maskedApiKey: null };
  }

  return {
    provider: dbUser.aiProvider,
    baseUrl: dbUser.aiBaseUrl,
    modelName: dbUser.aiModelName,
    hasApiKey: !!dbUser.aiApiKey,
    maskedApiKey: maskApiKey(dbUser.aiApiKey),
  };
}

export async function updateAIConfig(data: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { user } = await getAuthUser();

  if (data.provider !== "custom" && data.provider !== "default") {
    return { success: false, error: "Invalid provider. Must be 'custom' or 'default'." };
  }

  if (data.provider === "custom") {
    if (!data.modelName?.trim()) {
      return { success: false, error: "Model name is required for custom provider." };
    }
  }

  const updatePayload: {
    aiProvider: string | null;
    aiBaseUrl: string | null;
    aiModelName: string | null;
    aiApiKey?: string | null;
  } = {
    aiProvider: data.provider === "custom" ? "custom" : null,
    aiBaseUrl: data.provider === "custom" ? (data.baseUrl?.trim() || null) : null,
    aiModelName: data.provider === "custom" ? (data.modelName?.trim() || null) : null,
  };

  if (data.apiKey !== undefined && data.apiKey !== "") {
    updatePayload.aiApiKey = data.apiKey;
  } else if (data.provider === "default") {
    updatePayload.aiApiKey = null;
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: updatePayload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update AI config";
    return { success: false, error: message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function testAIConnection(data: {
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!data.modelName?.trim()) {
    return { success: false, error: "Model name is required." };
  }

  const client = new OpenAI({
    baseURL: data.baseUrl?.trim() || "https://api.openai.com/v1",
    apiKey: data.apiKey || "not-needed",
  });

  try {
    await client.chat.completions.create({
      model: data.modelName.trim(),
      messages: [{ role: "user", content: "Say hi" }],
      max_tokens: 5,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, error: message };
  }
}

export async function clearAIConfig(): Promise<{ success: boolean; error?: string }> {
  const { user } = await getAuthUser();

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { aiProvider: null, aiApiKey: null, aiBaseUrl: null, aiModelName: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear AI config";
    return { success: false, error: message };
  }

  revalidatePath("/settings");
  return { success: true };
}
