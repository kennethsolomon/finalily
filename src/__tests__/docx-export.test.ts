import { describe, it, expect } from "vitest";
import {
  formatCardType,
  formatClozeText,
  generateReviewerDocx,
} from "@/lib/docx-export";

describe("docx formatCardType", () => {
  it("maps FLASHCARD to readable label", () => {
    expect(formatCardType("FLASHCARD")).toBe("Flashcard");
  });

  it("maps MCQ to readable label", () => {
    expect(formatCardType("MCQ")).toBe("Multiple Choice");
  });

  it("returns raw type if unknown", () => {
    expect(formatCardType("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("docx formatClozeText", () => {
  it("replaces cloze markers with underscores", () => {
    expect(formatClozeText("The {{mitochondria}} is the powerhouse")).toBe(
      "The ____________ is the powerhouse"
    );
  });

  it("handles multiple markers", () => {
    expect(formatClozeText("{{A}} and {{B}}")).toBe(
      "____________ and ____________"
    );
  });
});

describe("generateReviewerDocx", () => {
  const deck = {
    title: "Biology 101",
    subject: "Biology",
    description: "Intro to bio",
  };

  const sampleCards = [
    {
      type: "FLASHCARD",
      prompt: "What is the powerhouse of the cell?",
      answer: "Mitochondria",
      explanation: "Produces ATP via cellular respiration.",
      options: null,
      cloze_text: null,
      position: 0,
    },
    {
      type: "MCQ",
      prompt: "Which organelle synthesizes proteins?",
      answer: "Ribosome",
      explanation: null,
      options: ["Nucleus", "Ribosome", "Golgi", "Lysosome"],
      cloze_text: null,
      position: 1,
    },
    {
      type: "CLOZE",
      prompt: "Complete the sentence",
      answer: "mitochondria",
      explanation: null,
      options: null,
      cloze_text: "The {{mitochondria}} is the powerhouse of the cell.",
      position: 2,
    },
    {
      type: "TRUE_FALSE",
      prompt: "DNA is found in the nucleus.",
      answer: "True",
      explanation: "DNA is in the nucleus.",
      options: null,
      cloze_text: null,
      position: 3,
    },
    {
      type: "IDENTIFICATION",
      prompt: "Identify the process converting sunlight to glucose.",
      answer: "Photosynthesis",
      explanation: null,
      options: null,
      cloze_text: null,
      position: 4,
    },
  ];

  it("returns a Buffer", async () => {
    const result = await generateReviewerDocx(deck, sampleCards);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("generates valid DOCX bytes (ZIP header)", async () => {
    const result = await generateReviewerDocx(deck, sampleCards);
    // DOCX is a ZIP file — starts with PK (0x50 0x4B)
    expect(result[0]).toBe(0x50);
    expect(result[1]).toBe(0x4b);
  });

  it("handles single card", async () => {
    const result = await generateReviewerDocx(deck, [sampleCards[0]]);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles deck with no description", async () => {
    const noDesc = { title: "Test", subject: "Test", description: null };
    const result = await generateReviewerDocx(noDesc, [sampleCards[0]]);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles all five card types", async () => {
    const result = await generateReviewerDocx(deck, sampleCards);
    expect(result.length).toBeGreaterThan(1000);
  });

  it("handles long answer text", async () => {
    const longCard = {
      ...sampleCards[0],
      answer: "This is a very long answer ".repeat(20),
    };
    const result = await generateReviewerDocx(deck, [longCard]);
    expect(result.length).toBeGreaterThan(0);
  });
});
