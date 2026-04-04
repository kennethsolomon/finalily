"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export function IdentificationEditor({ initialData, onSave, onCancel }: CardEditorProps) {
  const [prompt, setPrompt] = useState(initialData?.prompt ?? "");
  const [answer, setAnswer] = useState(initialData?.answer ?? "");
  const [explanation, setExplanation] = useState(initialData?.explanation ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !answer.trim()) return;
    onSave({
      prompt: prompt.trim(),
      answer: answer.trim(),
      explanation: explanation.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="id-prompt">Term / Question</Label>
        <Input
          id="id-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter the term or question..."
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="id-answer">Definition / Answer</Label>
        <Input
          id="id-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter the correct answer..."
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="id-explanation">Explanation (optional)</Label>
        <Textarea
          id="id-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Add extra context or notes..."
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
          disabled={!prompt.trim() || !answer.trim()}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Save
        </button>
      </div>
    </form>
  );
}
