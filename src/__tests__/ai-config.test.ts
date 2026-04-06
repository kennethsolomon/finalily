import { describe, it, expect, vi, beforeEach } from "vitest";
import { maskApiKey, getAIModel, DEFAULT_AI_MODEL } from "@/lib/openrouter";
import type { UserAIConfig } from "@/lib/openrouter";

// Mock OpenAI to avoid SDK validation in tests
vi.mock("openai", () => ({
  default: class MockOpenAI {
    baseURL: string;
    apiKey: string;
    constructor(opts: { baseURL?: string; apiKey?: string }) {
      this.baseURL = opts.baseURL ?? "";
      this.apiKey = opts.apiKey ?? "";
    }
  },
}));

// Re-import after mock is in place
const { createAIClient } = await import("@/lib/openrouter");

describe("maskApiKey", () => {
  it("returns null for null input", () => {
    expect(maskApiKey(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(maskApiKey("")).toBeNull();
  });

  it("masks short keys completely", () => {
    expect(maskApiKey("abc")).toBe("••••••••");
    expect(maskApiKey("12345678")).toBe("••••••••");
  });

  it("shows first 4 and last 4 chars for longer keys", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1••••cdef");
  });

  it("handles exactly 9 character key", () => {
    const result = maskApiKey("123456789");
    expect(result).toBe("1234••••6789");
  });
});

describe("createAIClient", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  });

  it("returns default OpenRouter client when config is null", () => {
    const client = createAIClient(null) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("https://openrouter.ai/api/v1");
  });

  it("returns default OpenRouter client when config is undefined", () => {
    const client = createAIClient(undefined) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("https://openrouter.ai/api/v1");
  });

  it("returns default client when provider is not custom", () => {
    const config: UserAIConfig = {
      ai_provider: null,
      ai_api_key: null,
      ai_base_url: null,
      ai_model_name: null,
    };
    const client = createAIClient(config) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("https://openrouter.ai/api/v1");
  });

  it("returns custom client when provider is custom with API key", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "test-key",
      ai_base_url: "http://localhost:11434/v1",
      ai_model_name: "llama3.2",
    };
    const client = createAIClient(config) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("http://localhost:11434/v1");
  });

  it("falls back to OpenAI base URL when custom has no base URL", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "test-key",
      ai_base_url: null,
      ai_model_name: "gpt-4o",
    };
    const client = createAIClient(config) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("https://api.openai.com/v1");
  });

  it("falls back to default when custom provider has no API key", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: null,
      ai_base_url: "http://localhost:11434/v1",
      ai_model_name: "llama3.2",
    };
    const client = createAIClient(config) as unknown as { baseURL: string };
    expect(client.baseURL).toBe("https://openrouter.ai/api/v1");
  });
});

describe("getAIModel", () => {
  it("returns default model when config is null", () => {
    expect(getAIModel(null)).toBe(DEFAULT_AI_MODEL);
  });

  it("returns default model when config is undefined", () => {
    expect(getAIModel(undefined)).toBe(DEFAULT_AI_MODEL);
  });

  it("returns default model when provider is not custom", () => {
    const config: UserAIConfig = {
      ai_provider: null,
      ai_api_key: null,
      ai_base_url: null,
      ai_model_name: null,
    };
    expect(getAIModel(config)).toBe(DEFAULT_AI_MODEL);
  });

  it("returns custom model when provider is custom", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "test-key",
      ai_base_url: "http://localhost:11434/v1",
      ai_model_name: "llama3.2",
    };
    expect(getAIModel(config)).toBe("llama3.2");
  });

  it("returns default model when custom provider has no model name", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "test-key",
      ai_base_url: null,
      ai_model_name: null,
    };
    expect(getAIModel(config)).toBe(DEFAULT_AI_MODEL);
  });

  it("returns default model when custom provider has empty model name", () => {
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "test-key",
      ai_base_url: null,
      ai_model_name: "",
    };
    expect(getAIModel(config)).toBe(DEFAULT_AI_MODEL);
  });
});
