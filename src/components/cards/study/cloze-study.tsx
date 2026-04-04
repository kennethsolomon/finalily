"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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

export function ClozeStudy({ card, onAnswer, showResult }: CardStudyProps) {
  const source = card.clozeText ?? card.prompt;

  const parts = useMemo(() => {
    const segments: { type: "text" | "blank"; value: string; index: number }[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let last = 0;
    let match;
    let blankIndex = 0;
    while ((match = regex.exec(source)) !== null) {
      if (match.index > last) {
        segments.push({ type: "text", value: source.slice(last, match.index), index: -1 });
      }
      segments.push({ type: "blank", value: match[1], index: blankIndex++ });
      last = match.index + match[0].length;
    }
    if (last < source.length) {
      segments.push({ type: "text", value: source.slice(last), index: -1 });
    }
    return segments;
  }, [source]);

  const blanks = parts.filter((p) => p.type === "blank");
  const [inputs, setInputs] = useState<string[]>(blanks.map(() => ""));
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    const res = blanks.map((b, i) =>
      inputs[i].trim().toLowerCase() === b.value.trim().toLowerCase()
    );
    setResults(res);
    setSubmitted(true);
    onAnswer(res.every(Boolean), inputs.map((s) => s.trim()).join("|||"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Fill in the blanks
        </p>
        <p className="text-base leading-relaxed">
          {parts.map((part, i) => {
            if (part.type === "text") return <span key={i}>{part.value}</span>;
            const idx = part.index;
            return (
              <span
                key={i}
                className={cn(
                  "inline-block mx-1 min-w-16 rounded border-b-2 px-1 text-center font-medium",
                  submitted && results[idx]
                    ? "border-green-500 text-green-700 dark:text-green-400"
                    : submitted && !results[idx]
                    ? "border-destructive text-destructive"
                    : "border-primary"
                )}
              >
                {submitted ? (results[idx] ? inputs[idx] : part.value) : inputs[idx] || "___"}
              </span>
            );
          })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {blanks.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
            <Input
              value={inputs[i]}
              onChange={(e) => {
                const next = [...inputs];
                next[i] = e.target.value;
                setInputs(next);
              }}
              placeholder={`Blank ${i + 1}`}
              disabled={submitted}
              className={cn(
                submitted && results[i] && "border-green-500 bg-green-500/5",
                submitted && !results[i] && "border-destructive bg-destructive/5"
              )}
            />
            {submitted && !results[i] && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                → {b.value}
              </span>
            )}
          </div>
        ))}

        {!submitted && blanks.length > 0 && (
          <button
            type="submit"
            disabled={inputs.some((v) => !v.trim())}
            className={cn(
              "w-full rounded-xl border border-primary bg-primary py-3 text-sm font-medium text-primary-foreground",
              "hover:bg-primary/90 transition-colors mt-2",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            Check Answers
          </button>
        )}
      </form>

      {blanks.length === 0 && !submitted && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          This card has no blanks to fill in. It may be misconfigured.
        </div>
      )}

      {submitted && card.explanation && (
        <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Explanation</p>
          {card.explanation}
        </div>
      )}
    </div>
  );
}
