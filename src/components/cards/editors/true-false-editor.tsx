"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CardEditorProps {
  initialData?: {
    prompt: string;
    answer: string;
    explanation?: string;
    options?: string[];
    clozeText?: string;
  };
  onSave: (data: {
    prompt: string;
    answer: string;
    explanation?: string;
    options?: string[];
    clozeText?: string;
  }) => void;
  onCancel: () => void;
}

export function TrueFalseEditor({ initialData, onSave, onCancel }: CardEditorProps) {
  const [statement, setStatement] = useState(initialData?.prompt ?? "");
  const [isTrue, setIsTrue] = useState(
    initialData?.answer?.toLowerCase() !== "false"
  );
  const [explanation, setExplanation] = useState(initialData?.explanation ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!statement.trim()) return;
    onSave({
      prompt: statement.trim(),
      answer: isTrue ? "true" : "false",
      explanation: explanation.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tf-statement">Statement</Label>
        <Textarea
          id="tf-statement"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Enter the true or false statement..."
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Correct Answer</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsTrue(true)}
            className={cn(
              "rounded-xl border py-3 text-sm font-bold transition-all",
              isTrue
                ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-border hover:bg-muted"
            )}
          >
            True
          </button>
          <button
            type="button"
            onClick={() => setIsTrue(false)}
            className={cn(
              "rounded-xl border py-3 text-sm font-bold transition-all",
              !isTrue
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border hover:bg-muted"
            )}
          >
            False
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tf-explanation">Explanation (optional)</Label>
        <Textarea
          id="tf-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain why this is true or false..."
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!statement.trim()}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Save
        </button>
      </div>
    </form>
  );
}
