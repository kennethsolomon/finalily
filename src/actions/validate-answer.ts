"use server";

import { getOpenRouterClient } from "@/lib/openrouter";

const VALIDATION_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const TIMEOUT_MS = 5000;

interface ValidationResult {
  isCorrect: boolean;
  explanation?: string;
  fallback?: boolean;
}

function exactMatch(userAnswer: string, correctAnswer: string): boolean {
  return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

export async function validateIdentificationAnswer(data: {
  userAnswer: string;
  correctAnswer: string;
  prompt: string;
}): Promise<ValidationResult> {
  const { userAnswer, correctAnswer, prompt } = data;

  // Fast path: exact match
  if (exactMatch(userAnswer, correctAnswer)) {
    return { isCorrect: true };
  }

  // Fast path: empty answer
  if (!userAnswer.trim()) {
    return { isCorrect: false };
  }

  try {
    const client = getOpenRouterClient();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const completion = await client.chat.completions.create(
      {
        model: VALIDATION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an answer validator for a study app. " +
              "Determine if the user's answer is semantically correct compared to the expected answer. " +
              "Accept answers that demonstrate understanding even if worded differently. " +
              "Reject answers that are vague, incomplete, or wrong. " +
              "Respond with ONLY a JSON object, no other text: {\"correct\": true/false, \"explanation\": \"explain why the answer is correct or incorrect\"}",
          },
          {
            role: "user",
            content:
              `Question: ${prompt}\n` +
              `Expected answer: ${correctAnswer}\n` +
              `User's answer: ${userAnswer}\n\n` +
              `Is the user's answer correct or essentially correct?`,
          },
        ],
        temperature: 0,
        max_tokens: 250,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = completion.choices[0]?.message?.content ?? "";

    // Strip chain-of-thought / thinking blocks that some models include
    const cleaned = content
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .trim();

    // Parse JSON response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          correct: boolean;
          explanation?: string;
        };
        const explanation = parsed.explanation?.trim();
        return {
          isCorrect: !!parsed.correct,
          explanation: explanation && explanation.length > 2 ? explanation : undefined,
        };
      } catch {
        // JSON was truncated or malformed — try to extract explanation below
      }
    }

    // Try to extract explanation from truncated/partial JSON
    const explMatch = cleaned.match(/"explanation"\s*:\s*"([^"]*)/);
    const extractedExpl = explMatch?.[1]?.trim();

    // Determine correctness from text content
    const lower = cleaned.toLowerCase();
    if (lower.includes("incorrect") || lower.includes("\"correct\": false") || lower.includes("\"correct\":false")) {
      return { isCorrect: false, explanation: extractedExpl && extractedExpl.length > 2 ? extractedExpl : undefined };
    }
    if (lower.includes("correct") || lower.includes("\"correct\": true") || lower.includes("\"correct\":true")) {
      return { isCorrect: true, explanation: extractedExpl && extractedExpl.length > 2 ? extractedExpl : undefined };
    }

    // Could not parse AI response, fall back to exact match
    return { isCorrect: exactMatch(userAnswer, correctAnswer), fallback: true };
  } catch {
    // AI unavailable — fall back to exact match
    return { isCorrect: exactMatch(userAnswer, correctAnswer), fallback: true };
  }
}
