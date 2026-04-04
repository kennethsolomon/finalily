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

export function MCQStudy({ card, onAnswer, showResult }: CardStudyProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const options = Array.isArray(card.options)
    ? (card.options as string[])
    : [];

  function handleSelect(option: string) {
    if (selected !== null) return;
    setSelected(option);
    onAnswer(option === card.answer);
  }

  function getOptionClass(option: string) {
    if (selected === null) {
      return "border-border bg-card hover:bg-muted cursor-pointer";
    }
    if (option === card.answer) {
      return "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
    }
    if (option === selected && option !== card.answer) {
      return "border-destructive bg-destructive/10 text-destructive";
    }
    return "border-border bg-card opacity-60";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Question
        </p>
        <p className="text-lg font-semibold">{card.prompt}</p>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleSelect(option)}
            className={cn(
              "w-full rounded-xl border p-4 text-left text-sm font-medium transition-all",
              getOptionClass(option)
            )}
          >
            <span className="mr-3 inline-flex size-6 items-center justify-center rounded-full border text-xs font-bold">
              {String.fromCharCode(65 + i)}
            </span>
            {option}
          </button>
        ))}
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
