import OpenAI from "openai";

export const AI_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

let _client: OpenAI | null = null;

export function getOpenRouterClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _client;
}
