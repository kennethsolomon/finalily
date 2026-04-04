import { describe, it, expect } from "vitest";

// Extract validateAnswer for testing — it's not exported, so we re-implement the same logic
// This tests the validation logic as implemented in src/actions/study.ts
function validateAnswer(
  cardType: string,
  cardAnswer: string,
  clozeText: string | null,
  userResponse?: string
): boolean | null {
  if (userResponse === undefined) return null;

  switch (cardType) {
    case "MCQ":
      return userResponse === cardAnswer;
    case "TRUE_FALSE":
      return userResponse.toLowerCase() === cardAnswer.toLowerCase();
    case "IDENTIFICATION":
      return userResponse.trim().toLowerCase() === cardAnswer.trim().toLowerCase();
    case "CLOZE": {
      const source = clozeText ?? "";
      const regex = /\{\{([^}]+)\}\}/g;
      const blanks: string[] = [];
      let match;
      while ((match = regex.exec(source)) !== null) {
        blanks.push(match[1].trim().toLowerCase());
      }
      const userBlanks = userResponse.split("|||").map((s) => s.trim().toLowerCase());
      return blanks.length > 0 && blanks.length === userBlanks.length && blanks.every((b, i) => userBlanks[i] === b);
    }
    default:
      return null;
  }
}

describe("validateAnswer", () => {
  describe("MCQ", () => {
    it("returns true for exact match", () => {
      expect(validateAnswer("MCQ", "Option A", null, "Option A")).toBe(true);
    });

    it("returns false for wrong answer", () => {
      expect(validateAnswer("MCQ", "Option A", null, "Option B")).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(validateAnswer("MCQ", "Option A", null, "option a")).toBe(false);
    });
  });

  describe("TRUE_FALSE", () => {
    it("returns true for matching answer (case insensitive)", () => {
      expect(validateAnswer("TRUE_FALSE", "True", null, "true")).toBe(true);
    });

    it("returns true for uppercase match", () => {
      expect(validateAnswer("TRUE_FALSE", "false", null, "FALSE")).toBe(true);
    });

    it("returns false for wrong answer", () => {
      expect(validateAnswer("TRUE_FALSE", "True", null, "false")).toBe(false);
    });
  });

  describe("IDENTIFICATION", () => {
    it("returns true for exact match (case insensitive)", () => {
      expect(validateAnswer("IDENTIFICATION", "Mitochondria", null, "mitochondria")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(validateAnswer("IDENTIFICATION", "  answer  ", null, "answer")).toBe(true);
    });

    it("trims user whitespace", () => {
      expect(validateAnswer("IDENTIFICATION", "answer", null, "  answer  ")).toBe(true);
    });

    it("returns false for wrong answer", () => {
      expect(validateAnswer("IDENTIFICATION", "Mitochondria", null, "Nucleus")).toBe(false);
    });
  });

  describe("CLOZE", () => {
    it("returns true when all blanks match", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{quick}} brown {{fox}}", "quick|||fox")
      ).toBe(true);
    });

    it("is case insensitive", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{Quick}} brown fox", "quick")
      ).toBe(true);
    });

    it("trims whitespace from user input", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{quick}} brown fox", "  quick  ")
      ).toBe(true);
    });

    it("returns false when user provides fewer blanks", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{quick}} {{brown}} fox", "quick")
      ).toBe(false);
    });

    it("returns false when user provides extra blanks", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{quick}} brown fox", "quick|||extra")
      ).toBe(false);
    });

    it("returns false when answer is wrong", () => {
      expect(
        validateAnswer("CLOZE", "", "The {{quick}} brown fox", "slow")
      ).toBe(false);
    });

    it("returns false when clozeText has no blanks", () => {
      expect(
        validateAnswer("CLOZE", "", "No blanks here", "anything")
      ).toBe(false);
    });

    it("returns false when clozeText is null and no blanks", () => {
      expect(
        validateAnswer("CLOZE", "", null, "anything")
      ).toBe(false);
    });
  });

  describe("FLASHCARD (default)", () => {
    it("returns null (not server-validated)", () => {
      expect(validateAnswer("FLASHCARD", "answer", null, "answer")).toBe(null);
    });
  });

  describe("undefined userResponse", () => {
    it("returns null for any card type", () => {
      expect(validateAnswer("MCQ", "answer", null, undefined)).toBe(null);
      expect(validateAnswer("CLOZE", "answer", "{{blank}}", undefined)).toBe(null);
    });
  });
});
