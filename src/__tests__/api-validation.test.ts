import { describe, it, expect } from "vitest";

// Test input validation logic from API routes
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_CARD_TYPES = ["FLASHCARD", "MCQ", "IDENTIFICATION", "TRUE_FALSE", "CLOZE"];

function validateTopicInput(body: {
  deckId?: string;
  topic?: string;
  difficulty?: string;
  cardCount?: number;
  typeMix?: string[];
}): string | null {
  if (!body.deckId || !body.topic || !body.cardCount || !body.typeMix?.length) {
    return "Missing required fields";
  }
  if (body.difficulty && !VALID_DIFFICULTIES.includes(body.difficulty)) {
    return "Invalid difficulty";
  }
  if (body.cardCount < 1 || body.cardCount > 50) {
    return "cardCount out of range";
  }
  if (body.typeMix.some((t) => !VALID_CARD_TYPES.includes(t))) {
    return "Invalid card type";
  }
  return null;
}

function validateRegenerateInput(body: {
  cardId?: string;
  newType?: string;
}): string | null {
  if (!body.cardId) return "cardId required";
  if (body.newType && !VALID_CARD_TYPES.includes(body.newType)) {
    return "Invalid card type";
  }
  return null;
}

describe("topic route validation", () => {
  const validBody = {
    deckId: "deck-1",
    topic: "Biology",
    difficulty: "medium",
    cardCount: 10,
    typeMix: ["FLASHCARD", "MCQ"],
  };

  it("accepts valid input", () => {
    expect(validateTopicInput(validBody)).toBe(null);
  });

  it("rejects missing deckId", () => {
    expect(validateTopicInput({ ...validBody, deckId: undefined })).toBe("Missing required fields");
  });

  it("rejects missing topic", () => {
    expect(validateTopicInput({ ...validBody, topic: undefined })).toBe("Missing required fields");
  });

  it("rejects missing cardCount", () => {
    expect(validateTopicInput({ ...validBody, cardCount: undefined })).toBe("Missing required fields");
  });

  it("rejects empty typeMix", () => {
    expect(validateTopicInput({ ...validBody, typeMix: [] })).toBe("Missing required fields");
  });

  it("rejects invalid difficulty", () => {
    expect(validateTopicInput({ ...validBody, difficulty: "extreme" })).toBe("Invalid difficulty");
  });

  it("accepts all valid difficulties", () => {
    for (const d of VALID_DIFFICULTIES) {
      expect(validateTopicInput({ ...validBody, difficulty: d })).toBe(null);
    }
  });

  it("rejects cardCount below 1", () => {
    expect(validateTopicInput({ ...validBody, cardCount: 0 })).toBe("Missing required fields");
  });

  it("rejects cardCount above 50", () => {
    expect(validateTopicInput({ ...validBody, cardCount: 51 })).toBe("cardCount out of range");
  });

  it("accepts cardCount of 1", () => {
    expect(validateTopicInput({ ...validBody, cardCount: 1 })).toBe(null);
  });

  it("accepts cardCount of 50", () => {
    expect(validateTopicInput({ ...validBody, cardCount: 50 })).toBe(null);
  });

  it("rejects invalid card type in typeMix", () => {
    expect(validateTopicInput({ ...validBody, typeMix: ["FLASHCARD", "INVALID"] })).toBe("Invalid card type");
  });

  it("accepts all valid card types", () => {
    expect(validateTopicInput({ ...validBody, typeMix: VALID_CARD_TYPES })).toBe(null);
  });
});

describe("regenerate route validation", () => {
  it("accepts valid input", () => {
    expect(validateRegenerateInput({ cardId: "card-1" })).toBe(null);
  });

  it("accepts valid input with newType", () => {
    expect(validateRegenerateInput({ cardId: "card-1", newType: "MCQ" })).toBe(null);
  });

  it("rejects missing cardId", () => {
    expect(validateRegenerateInput({})).toBe("cardId required");
  });

  it("rejects invalid newType", () => {
    expect(validateRegenerateInput({ cardId: "card-1", newType: "INVALID" })).toBe("Invalid card type");
  });

  it("accepts all valid card types as newType", () => {
    for (const t of VALID_CARD_TYPES) {
      expect(validateRegenerateInput({ cardId: "card-1", newType: t })).toBe(null);
    }
  });
});
