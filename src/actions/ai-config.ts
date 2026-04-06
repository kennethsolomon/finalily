"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { maskApiKey } from "@/lib/openrouter";
import OpenAI from "openai";

export interface AIConfigResponse {
  provider: string | null;
  baseUrl: string | null;
  modelName: string | null;
  hasApiKey: boolean;
  maskedApiKey: string | null;
}

export async function getAIConfig(): Promise<AIConfigResponse> {
  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("users")
    .select("ai_provider, ai_api_key, ai_base_url, ai_model_name")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return { provider: null, baseUrl: null, modelName: null, hasApiKey: false, maskedApiKey: null };
  }

  return {
    provider: data.ai_provider,
    baseUrl: data.ai_base_url,
    modelName: data.ai_model_name,
    hasApiKey: !!data.ai_api_key,
    maskedApiKey: maskApiKey(data.ai_api_key),
  };
}

export async function updateAIConfig(data: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getAuthUser();

  if (data.provider !== "custom" && data.provider !== "default") {
    return { success: false, error: "Invalid provider. Must be 'custom' or 'default'." };
  }

  if (data.provider === "custom") {
    if (!data.modelName?.trim()) {
      return { success: false, error: "Model name is required for custom provider." };
    }
  }

  const updatePayload: Record<string, string | null> = {
    ai_provider: data.provider === "custom" ? "custom" : null,
    ai_base_url: data.provider === "custom" ? (data.baseUrl?.trim() || null) : null,
    ai_model_name: data.provider === "custom" ? (data.modelName?.trim() || null) : null,
  };

  // Only update API key if explicitly provided (non-empty string)
  // This allows saving other fields without overwriting the existing key
  if (data.apiKey !== undefined && data.apiKey !== "") {
    updatePayload.ai_api_key = data.apiKey;
  } else if (data.provider === "default") {
    updatePayload.ai_api_key = null;
  }

  const { error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
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
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("users")
    .update({
      ai_provider: null,
      ai_api_key: null,
      ai_base_url: null,
      ai_model_name: null,
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}
