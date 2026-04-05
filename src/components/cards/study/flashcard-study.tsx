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
  onAnswer: (isCorrect: boolean, userResponse?: string) => void;
  showResult: boolean;
  hideAnswerButtons?: boolean;
}

export function FlashcardStudy({ card, onAnswer, showResult, hideAnswerButtons }: CardStudyProps) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  function handleFlip() {
    if (!answered && !hideAnswerButtons) setFlipped(true);
    // In LEARN mode (hideAnswerButtons), flip still works but we signal "answered"
    // so the parent shows SM-2 rating buttons
    if (hideAnswerButtons && !flipped) {
      setFlipped(true);
      // Don't call onAnswer — parent will use rating buttons to determine correctness
      setAnswered(true);
      onAnswer(true); // placeholder; actual correctness derived from SM-2 rating
    }
  }

  function handleAnswer(isCorrect: boolean) {
    setAnswered(true);
    onAnswer(isCorrect);
  }

  // Dynamic text sizing based on content length
  const answerLen = card.answer.length;
  const answerTextClass =
    answerLen < 50 ? "text-xl font-semibold" :
    answerLen < 150 ? "text-base font-semibold" :
    "text-sm font-medium";

  const promptLen = card.prompt.length;
  const promptTextClass =
    promptLen < 80 ? "text-xl font-semibold" :
    promptLen < 200 ? "text-base font-semibold" :
    "text-sm font-medium";

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="w-full cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleFlip}
      >
        <div
          className={cn(
            "relative w-full transition-transform duration-500",
            !flipped && "min-h-[220px]"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm",
              flipped ? "invisible absolute inset-0" : "min-h-[220px]"
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Tap to reveal answer
            </p>
            <p className={promptTextClass}>{card.prompt}</p>
          </div>

          {/* Back */}
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm overflow-y-auto max-h-[70vh]",
              flipped ? "min-h-[220px]" : "invisible absolute inset-0"
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Answer
            </p>
            <p className={cn(answerTextClass, "mb-4")}>{card.answer}</p>
            {card.explanation && (
              <p className="text-sm text-foreground/70 border-t pt-4 mt-2 leading-relaxed">
                {card.explanation}
              </p>
            )}
          </div>
        </div>
      </div>

      {flipped && !answered && !showResult && !hideAnswerButtons && (
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
