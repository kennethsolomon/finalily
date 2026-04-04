"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CardStudyProps {
  card: {
    id: string;
    type: string;
    prompt: string;
    answer: string;
    explanation?: string | null;
    options?: unknown;
    clozeText?: string | null;
  };
  onAnswer: (isCorrect: boolean) => void;
  showResult: boolean;
}

export function FlashcardStudy({ card, onAnswer, showResult }: CardStudyProps) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  function handleFlip() {
    if (!answered) setFlipped(true);
  }

  function handleAnswer(isCorrect: boolean) {
    setAnswered(true);
    onAnswer(isCorrect);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="w-full cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleFlip}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "220px",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Tap to reveal answer
            </p>
            <p className="text-xl font-semibold">{card.prompt}</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Answer
            </p>
            <p className="text-xl font-semibold mb-4">{card.answer}</p>
            {card.explanation && (
              <p className="text-sm text-muted-foreground border-t pt-4 mt-2">
                {card.explanation}
              </p>
            )}
          </div>
        </div>
      </div>

      {flipped && !answered && !showResult && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => handleAnswer(false)}
            className={cn(
              "flex-1 rounded-lg border border-destructive/40 bg-destructive/10 py-3 text-sm font-medium text-destructive",
              "hover:bg-destructive/20 transition-colors"
            )}
          >
            Incorrect
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className={cn(
              "flex-1 rounded-lg border border-green-500/40 bg-green-500/10 py-3 text-sm font-medium text-green-700 dark:text-green-400",
              "hover:bg-green-500/20 transition-colors"
            )}
          >
            Correct
          </button>
        </div>
      )}
    </div>
  );
}
