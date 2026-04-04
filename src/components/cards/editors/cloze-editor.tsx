"use client";

import { useState, useMemo } from "react";
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

export function ClozeEditor({ initialData, onSave, onCancel }: CardEditorProps) {
  const [text, setText] = useState(initialData?.clozeText ?? initialData?.prompt ?? "");
  const [explanation, setExplanation] = useState(initialData?.explanation ?? "");

  const blanks = useMemo(() => {
    const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)];
    return matches.map((m) => m[1]);
  }, [text]);

  const preview = useMemo(() => {
    return text.replace(/\{\{([^}]+)\}\}/g, "___");
  }, [text]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || blanks.length === 0) return;
    onSave({
      prompt: text.trim(),
      answer: blanks.join(", "),
      explanation: explanation.trim() || undefined,
      clozeText: text.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cloze-text">Cloze Text</Label>
        <p className="text-xs text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5 font-mono">{`{{word}}`}</code> to mark blanks. Example:{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">{`The capital of France is {{Paris}}.`}</code>
        </p>
        <Textarea
          id="cloze-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`The mitochondria is the {{powerhouse}} of the cell.`}
          className="font-mono text-sm"
          required
        />
      </div>

      {blanks.length > 0 && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Preview
          </p>
          <p className="text-sm">{preview}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {blanks.map((b, i) => (
              <span
                key={i}
                className="inline-block rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                Blank {i + 1}: {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {blanks.length === 0 && text.trim() && (
        <p className="text-xs text-destructive">
          No blanks detected. Use {`{{word}}`} to create blanks.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cloze-explanation">Explanation (optional)</Label>
        <Textarea
          id="cloze-explanation"
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
          disabled={!text.trim() || blanks.length === 0}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Save
        </button>
      </div>
    </form>
  );
}
