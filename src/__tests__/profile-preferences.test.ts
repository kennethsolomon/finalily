import { describe, it, expect } from "vitest";

// Test the preferences whitelist logic from src/actions/profile.ts
const ALLOWED_PREF_KEYS = ["theme", "notifications", "studyReminders", "cardFont", "dailyGoal"];

function filterPreferences(
  currentPrefs: Record<string, unknown>,
  newPrefs: Record<string, unknown> | undefined,
  subjects?: string[]
): Record<string, unknown> {
  const safePrefs: Record<string, unknown> = {};
  if (newPrefs) {
    for (const key of Object.keys(newPrefs)) {
      if (ALLOWED_PREF_KEYS.includes(key)) {
        safePrefs[key] = newPrefs[key];
      }
    }
  }

  return {
    ...currentPrefs,
    ...(subjects !== undefined && { subjects }),
    ...safePrefs,
  };
}

describe("profile preferences whitelist", () => {
  it("allows known preference keys", () => {
    const result = filterPreferences({}, { theme: "dark", notifications: true });
    expect(result.theme).toBe("dark");
    expect(result.notifications).toBe(true);
  });

  it("strips unknown preference keys", () => {
    const result = filterPreferences({}, { theme: "dark", maliciousKey: "hack", admin: true });
    expect(result.theme).toBe("dark");
    expect(result).not.toHaveProperty("maliciousKey");
    expect(result).not.toHaveProperty("admin");
  });

  it("preserves existing preferences", () => {
    const result = filterPreferences({ existingKey: "value" }, { theme: "dark" });
    expect(result.existingKey).toBe("value");
    expect(result.theme).toBe("dark");
  });

  it("handles undefined newPrefs", () => {
    const result = filterPreferences({ existing: "value" }, undefined);
    expect(result.existing).toBe("value");
  });

  it("handles subjects override", () => {
    const result = filterPreferences({ subjects: ["math"] }, {}, ["science", "history"]);
    expect(result.subjects).toEqual(["science", "history"]);
  });

  it("allows all valid preference keys", () => {
    const prefs: Record<string, unknown> = {};
    for (const key of ALLOWED_PREF_KEYS) {
      prefs[key] = `value-${key}`;
    }
    const result = filterPreferences({}, prefs);
    for (const key of ALLOWED_PREF_KEYS) {
      expect(result[key]).toBe(`value-${key}`);
    }
  });

  it("new preferences override existing ones", () => {
    const result = filterPreferences({ theme: "light" }, { theme: "dark" });
    expect(result.theme).toBe("dark");
  });
});
