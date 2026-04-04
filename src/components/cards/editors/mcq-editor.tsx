"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

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

export function MCQEditor({ initialData, onSave, onCancel }: CardEditorProps) {
  const [prompt, setPrompt] = useState(initialData?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(
    initialData?.options ?? ["", ""]
  );
  const [correctIndex, setCorrectIndex] = useState(() => {
    const idx = initialData?.options?.indexOf(initialData?.answer ?? "") ?? -1;
    return idx >= 0 ? idx : 0;
  });
  const [explanation, setExplanation] = useState(initialData?.explanation ?? "");

  function addOption() {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next);
    if (correctIndex === i) setCorrectIndex(0);
    else if (correctIndex > i) setCorrectIndex(correctIndex - 1);
  }

  function updateOption(i: number, val: string) {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = options.filter((o) => o.trim());
    if (!prompt.trim() || filled.length < 2) return;
    onSave({
      prompt: prompt.trim(),
      answer: options[correctIndex].trim(),
      explanation: explanation.trim() || undefined,
      options: filled,
    });
  }

  const canSubmit = prompt.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mcq-prompt">Question</Label>
        <Textarea
          id="mcq-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your multiple choice question..."
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Options (mark the correct answer)</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              className="h-4 w-4 accent-primary"
            />
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <Plus className="size-4" />
            Add option
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mcq-explanation">Explanation (optional)</Label>
        <Textarea
          id="mcq-explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Why is this the correct answer?"
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
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Save
        </button>
      </div>
    </form>
  );
}
