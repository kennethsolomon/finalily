import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAIConfigured } from "@/lib/openrouter";
import type { UserAIConfig } from "@/lib/openrouter";

describe("isAIConfigured", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when OPENROUTER_API_KEY is empty and config is null", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(isAIConfigured(null)).toBe(false);
  });

  it("returns false when OPENROUTER_API_KEY is not set and config is undefined", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(isAIConfigured(undefined)).toBe(false);
  });

  it("returns true when OPENROUTER_API_KEY is set", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-openrouter-test");
    expect(isAIConfigured(null)).toBe(true);
  });

  it("returns true when custom config has provider and api key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: "sk-custom-key",
      ai_base_url: null,
      ai_model_name: null,
    };
    expect(isAIConfigured(config)).toBe(true);
  });

  it("returns false when custom config provider set but no api key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: null,
      ai_base_url: "http://localhost:11434/v1",
      ai_model_name: "llama3.2",
    };
    expect(isAIConfigured(config)).toBe(false);
  });

  it("returns true when custom config has no key but OPENROUTER_API_KEY is set", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-openrouter-test");
    const config: UserAIConfig = {
      ai_provider: "custom",
      ai_api_key: null,
      ai_base_url: null,
      ai_model_name: null,
    };
    expect(isAIConfigured(config)).toBe(true);
  });
});

describe("offline auth fallback logic", () => {
  it("falls back to getSession when getUser throws a network error", async () => {
    const mockUser = { id: "user-123", email: "user@test.com" };
    const mockGetUser = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: mockUser } },
    });
    const mockAuth = { getUser: mockGetUser, getSession: mockGetSession };

    let user = null;
    try {
      const { data } = await mockAuth.getUser();
      user = data.user;
    } catch {
      const { data } = await mockAuth.getSession();
      user = data.session?.user ?? null;
    }

    expect(user).toEqual(mockUser);
    expect(mockGetSession).toHaveBeenCalledOnce();
  });

  it("returns null when both getUser throws and session is null", async () => {
    const mockGetUser = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: null },
    });
    const mockAuth = { getUser: mockGetUser, getSession: mockGetSession };

    let user = null;
    try {
      const { data } = await mockAuth.getUser();
      user = data.user;
    } catch {
      const { data } = await mockAuth.getSession();
      user = data.session?.user ?? null;
    }

    expect(user).toBeNull();
  });

  it("uses getUser result when network is available, skips getSession", async () => {
    const mockUser = { id: "user-456", email: "online@test.com" };
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    const mockGetSession = vi.fn();
    const mockAuth = { getUser: mockGetUser, getSession: mockGetSession };

    let user = null;
    try {
      const { data } = await mockAuth.getUser();
      user = data.user;
    } catch {
      const { data } = await mockAuth.getSession();
      user = data.session?.user ?? null;
    }

    expect(user).toEqual(mockUser);
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
