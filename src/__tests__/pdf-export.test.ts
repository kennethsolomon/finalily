import { describe, it, expect } from "vitest";
import { formatCardType, formatClozeText, generateReviewerPdf } from "@/lib/pdf-export";

describe("formatCardType", () => {
  it("maps FLASHCARD to readable label", () => {
    expect(formatCardType("FLASHCARD")).toBe("Flashcard");
  });

  it("maps MCQ to readable label", () => {
    expect(formatCardType("MCQ")).toBe("Multiple Choice");
  });

  it("maps IDENTIFICATION to readable label", () => {
    expect(formatCardType("IDENTIFICATION")).toBe("Identification");
  });

  it("maps TRUE_FALSE to readable label", () => {
    expect(formatCardType("TRUE_FALSE")).toBe("True or False");
  });

  it("maps CLOZE to readable label", () => {
    expect(formatCardType("CLOZE")).toBe("Fill-in-the-Blank");
  });

  it("returns raw type if unknown", () => {
    expect(formatCardType("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("formatClozeText", () => {
  it("replaces single cloze marker with underscores", () => {
    const result = formatClozeText("The {{mitochondria}} is the powerhouse of the cell");
    expect(result).toBe("The ____________ is the powerhouse of the cell");
  });

  it("replaces multiple cloze markers", () => {
    const result = formatClozeText("{{Photosynthesis}} converts {{sunlight}} into energy");
    expect(result).toBe("____________ converts ____________ into energy");
  });

  it("returns text unchanged when no markers present", () => {
    const text = "Plain text with no blanks";
    expect(formatClozeText(text)).toBe(text);
  });

  it("handles empty cloze marker", () => {
    // Edge case: {{}} should not match since regex requires at least one char
    const result = formatClozeText("Test {{}} text");
    expect(result).toBe("Test {{}} text");
  });
});

describe("generateReviewerPdf", () => {
  const deck = { title: "Biology 101", subject: "Biology", description: "Intro to bio" };

  const sampleCards = [
    {
      type: "FLASHCARD",
      prompt: "What is the powerhouse of the cell?",
      answer: "Mitochondria",
      explanation: "Mitochondria produce ATP through cellular respiration.",
      options: null,
      cloze_text: null,
      position: 0,
    },
    {
      type: "MCQ",
      prompt: "Which organelle is responsible for protein synthesis?",
      answer: "Ribosome",
      explanation: null,
      options: ["Nucleus", "Ribosome", "Golgi apparatus", "Lysosome"],
      cloze_text: null,
      position: 1,
    },
    {
      type: "CLOZE",
      prompt: "Complete the sentence about cell biology",
      answer: "mitochondria",
      explanation: null,
      options: null,
      cloze_text: "The {{mitochondria}} is the powerhouse of the cell.",
      position: 2,
    },
    {
      type: "TRUE_FALSE",
      prompt: "DNA is found in the nucleus of a cell.",
      answer: "True",
      explanation: "DNA is primarily located in the cell nucleus.",
      options: null,
      cloze_text: null,
      position: 3,
    },
    {
      type: "IDENTIFICATION",
      prompt: "Identify the process by which plants convert sunlight into glucose.",
      answer: "Photosynthesis",
      explanation: null,
      options: null,
      cloze_text: null,
      position: 4,
    },
  ];

  it("returns a non-empty Uint8Array", () => {
    const result = generateReviewerPdf(deck, sampleCards);
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it("generates valid PDF bytes starting with PDF header", () => {
    const result = generateReviewerPdf(deck, sampleCards);
    const bytes = new Uint8Array(result);
    // PDF files start with %PDF-
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("handles deck with single card", () => {
    const result = generateReviewerPdf(deck, [sampleCards[0]]);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles deck with no description", () => {
    const deckNoDesc = { title: "Test", subject: "Test", description: null };
    const result = generateReviewerPdf(deckNoDesc, [sampleCards[0]]);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles MCQ cards with correct answer in options", () => {
    const mcqOnly = [sampleCards[1]];
    const result = generateReviewerPdf(deck, mcqOnly);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles CLOZE cards with cloze text", () => {
    const clozeOnly = [sampleCards[2]];
    const result = generateReviewerPdf(deck, clozeOnly);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles many cards across multiple pages", () => {
    // Create 30 cards to force pagination
    const manyCards = Array.from({ length: 30 }, (_, i) => ({
      ...sampleCards[0],
      position: i,
      prompt: `Question ${i + 1}: ${sampleCards[0].prompt}`,
    }));
    const result = generateReviewerPdf(deck, manyCards);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles long prompts that wrap", () => {
    const longPromptCard = {
      ...sampleCards[0],
      prompt: "This is a very long prompt that should wrap across multiple lines in the PDF document. ".repeat(5),
    };
    const result = generateReviewerPdf(deck, [longPromptCard]);
    expect(new Uint8Array(result).length).toBeGreaterThan(0);
  });

  it("handles cards with all five types", () => {
    const result = generateReviewerPdf(deck, sampleCards);
    const bytes = new Uint8Array(result);
    // Should be a reasonably sized PDF with 5 cards + cover
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
