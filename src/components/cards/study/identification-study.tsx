"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { validateIdentificationAnswer } from "@/actions/validate-answer";
import { Loader2, ChevronDown, Sparkles } from "lucide-react";

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

export function IdentificationStudy({ card, onAnswer, showResult }: CardStudyProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [validating, setValidating] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted || validating || !value.trim()) return;

    setValidating(true);

    try {
      const result = await validateIdentificationAnswer({
        userAnswer: value.trim(),
        correctAnswer: card.answer.trim(),
        prompt: card.prompt,
      });

      setIsCorrect(result.isCorrect);
      if (result.explanation) setAiExplanation(result.explanation);
      setSubmitted(true);
      onAnswer(result.isCorrect, value.trim());
    } catch {
      // Fallback to exact match if server action fails
      const correct = value.trim().toLowerCase() === card.answer.trim().toLowerCase();
      setIsCorrect(correct);
      setSubmitted(true);
      onAnswer(correct, value.trim());
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Identify
        </p>
        <p className="text-lg font-semibold">{card.prompt}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your answer..."
          disabled={submitted || validating}
          className={cn(
            "h-12 text-base",
            submitted && isCorrect && "border-green-500 bg-green-500/5",
            submitted && !isCorrect && "border-destructive bg-destructive/5"
          )}
        />

        {!submitted && (
          <button
            type="submit"
            disabled={!value.trim() || validating}
            className={cn(
              "w-full rounded-xl border border-primary bg-primary py-3 text-sm font-medium text-primary-foreground",
              "hover:bg-primary/90 transition-colors",
              "disabled:opacity-50 disabled:pointer-events-none",
              "flex items-center justify-center gap-2"
            )}
          >
            {validating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking your answer...
              </>
            ) : (
              "Submit Answer"
            )}
          </button>
        )}
      </form>

      {submitted && (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            isCorrect
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          <p className="font-medium mb-1">{isCorrect ? "Correct!" : "Incorrect"}</p>
          {!isCorrect && (
            <p className="text-muted-foreground">
              Correct answer: <span className="font-semibold text-foreground">{card.answer}</span>
            </p>
          )}
          {aiExplanation && (
            <details className="mt-2 group">
              <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                <Sparkles className="h-3 w-3" />
                <span>AI reasoning</span>
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 text-xs text-muted-foreground italic pl-[18px]">{aiExplanation}</p>
            </details>
          )}
          {card.explanation && (
            <p className="mt-2 text-muted-foreground">{card.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
