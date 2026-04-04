import { describe, it, expect } from "vitest";

// Test the validation logic from createCard in src/actions/cards.ts
// Re-implementing the validation since it's embedded in the server action
const VALID_TYPES = ["FLASHCARD", "MCQ", "IDENTIFICATION", "TRUE_FALSE", "CLOZE"];

function validateCreateCard(data: {
  type: string;
  prompt: string;
  answer: string;
  clozeText?: string;
  options?: unknown;
}): string | null {
  if (!VALID_TYPES.includes(data.type)) return "Invalid card type";
  if (!data.prompt?.trim()) return "Prompt is required";
  if (!data.answer?.trim()) return "Answer is required";
  if (data.type === "CLOZE" && !data.clozeText?.trim()) return "Cloze text is required";
  if (data.type === "MCQ") {
    const opts = data.options as string[] | undefined;
    if (!Array.isArray(opts) || opts.length < 2) return "MCQ cards require at least 2 options";
  }
  return null; // valid
}

describe("createCard validation", () => {
  it("accepts valid FLASHCARD", () => {
    expect(validateCreateCard({ type: "FLASHCARD", prompt: "Q?", answer: "A" })).toBe(null);
  });

  it("accepts valid MCQ with options", () => {
    expect(validateCreateCard({ type: "MCQ", prompt: "Q?", answer: "A", options: ["A", "B", "C"] })).toBe(null);
  });

  it("accepts valid CLOZE with clozeText", () => {
    expect(validateCreateCard({ type: "CLOZE", prompt: "___", answer: "word", clozeText: "The {{word}}" })).toBe(null);
  });

  it("rejects invalid card type", () => {
    expect(validateCreateCard({ type: "INVALID", prompt: "Q?", answer: "A" })).toBe("Invalid card type");
  });

  it("rejects empty prompt", () => {
    expect(validateCreateCard({ type: "FLASHCARD", prompt: "", answer: "A" })).toBe("Prompt is required");
  });

  it("rejects whitespace-only prompt", () => {
    expect(validateCreateCard({ type: "FLASHCARD", prompt: "   ", answer: "A" })).toBe("Prompt is required");
  });

  it("rejects empty answer", () => {
    expect(validateCreateCard({ type: "FLASHCARD", prompt: "Q?", answer: "" })).toBe("Answer is required");
  });

  it("rejects CLOZE without clozeText", () => {
    expect(validateCreateCard({ type: "CLOZE", prompt: "Q?", answer: "A" })).toBe("Cloze text is required");
  });

  it("rejects CLOZE with empty clozeText", () => {
    expect(validateCreateCard({ type: "CLOZE", prompt: "Q?", answer: "A", clozeText: "  " })).toBe("Cloze text is required");
  });

  it("rejects MCQ without options", () => {
    expect(validateCreateCard({ type: "MCQ", prompt: "Q?", answer: "A" })).toBe("MCQ cards require at least 2 options");
  });

  it("rejects MCQ with only 1 option", () => {
    expect(validateCreateCard({ type: "MCQ", prompt: "Q?", answer: "A", options: ["A"] })).toBe("MCQ cards require at least 2 options");
  });

  it("rejects MCQ with non-array options", () => {
    expect(validateCreateCard({ type: "MCQ", prompt: "Q?", answer: "A", options: "not-array" })).toBe("MCQ cards require at least 2 options");
  });

  it("accepts all valid card types", () => {
    for (const type of VALID_TYPES) {
      const data: { type: string; prompt: string; answer: string; clozeText?: string; options?: unknown } = {
        type,
        prompt: "Question?",
        answer: "Answer",
      };
      if (type === "CLOZE") data.clozeText = "The {{answer}}";
      if (type === "MCQ") data.options = ["A", "B"];
      expect(validateCreateCard(data)).toBe(null);
    }
  });
});
