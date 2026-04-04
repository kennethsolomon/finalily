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
}

export function TrueFalseStudy({ card, onAnswer, showResult }: CardStudyProps) {
  const [selected, setSelected] = useState<boolean | null>(null);

  const correctAnswer = card.answer.toLowerCase() === "true";

  function handleSelect(value: boolean) {
    if (selected !== null) return;
    setSelected(value);
    onAnswer(value === correctAnswer, String(value));
  }

  function getButtonClass(value: boolean) {
    if (selected === null) {
      return "border-border bg-card hover:bg-muted cursor-pointer";
    }
    if (value === correctAnswer) {
      return "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
    }
    if (value === selected && value !== correctAnswer) {
      return "border-destructive bg-destructive/10 text-destructive";
    }
    return "border-border bg-card opacity-60";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          True or False?
        </p>
        <p className="text-lg font-semibold">{card.prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleSelect(true)}
          className={cn(
            "rounded-xl border py-6 text-lg font-bold transition-all",
            getButtonClass(true)
          )}
        >
          True
        </button>
        <button
          onClick={() => handleSelect(false)}
          className={cn(
            "rounded-xl border py-6 text-lg font-bold transition-all",
            getButtonClass(false)
          )}
        >
          False
        </button>
      </div>

      {selected !== null && card.explanation && (
        <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Explanation</p>
          {card.explanation}
        </div>
      )}
    </div>
  );
}
