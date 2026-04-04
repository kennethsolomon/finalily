"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Upload, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createDeck } from "@/actions/decks";
import { GenerationLoading } from "@/components/generation-loading";

type Mode = "choose" | "topic" | "pdf" | "manual";

const CARD_TYPES = [
  { id: "FLASHCARD", label: "Flashcard" },
  { id: "MCQ", label: "Multiple Choice" },
  { id: "IDENTIFICATION", label: "Identification" },
  { id: "TRUE_FALSE", label: "True / False" },
  { id: "CLOZE", label: "Fill-in-the-Blank" },
];

export default function NewDeckPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Topic/PDF form state
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [cardCount, setCardCount] = useState(15);
  const [typeMix, setTypeMix] = useState<string[]>(["FLASHCARD", "MCQ"]);

  // PDF state
  const [file, setFile] = useState<File | null>(null);

  // Manual form state
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualDescription, setManualDescription] = useState("");

  function toggleType(typeId: string) {
    setTypeMix((prev) =>
      prev.includes(typeId)
        ? prev.length > 1
          ? prev.filter((t) => t !== typeId)
          : prev
        : [...prev, typeId]
    );
  }

  async function handleTopicSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const deck = await createDeck({
        title: topic.trim(),
        subject: topic.trim(),
        sourceType: "TOPIC",
      });
      const res = await fetch("/api/generate/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: deck.id,
          topic: topic.trim(),
          difficulty,
          cardCount,
          typeMix,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }
      // consume stream
      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      toast.success("Cards generated! Redirecting to review...");
      router.push(`/decks/${deck.id}/review`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Generation failed", { description: msg });
      setError(msg);
      setLoading(false);
    }
  }

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file || !topic.trim()) return;
    setLoading(true);
    try {
      const deck = await createDeck({
        title: topic.trim(),
        subject: topic.trim(),
        sourceType: "PDF",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("deckId", deck.id);
      formData.append("topic", topic.trim());
      formData.append("difficulty", difficulty);
      formData.append("cardCount", String(cardCount));
      formData.append("typeMix", JSON.stringify(typeMix));

      const res = await fetch("/api/generate/pdf", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }
      toast.success("PDF processed! Redirecting to review...");
      router.push(`/decks/${deck.id}/review`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Generation failed", { description: msg });
      setError(msg);
      setLoading(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!manualTitle.trim() || !manualSubject.trim()) return;
    setLoading(true);
    try {
      const deck = await createDeck({
        title: manualTitle.trim(),
        subject: manualSubject.trim(),
        description: manualDescription.trim() || undefined,
        sourceType: "MANUAL",
      });
      toast.success("Deck created!");
      router.push(`/decks/${deck.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Failed to create deck", { description: msg });
      setError(msg);
      setLoading(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create a new deck</h1>
          <p className="text-muted-foreground">Choose how you want to build it</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <button onClick={() => setMode("topic")} className="text-left">
            <Card className="hover:border-primary/60 transition-colors h-full cursor-pointer">
              <CardHeader>
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">From Topic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Enter a topic and let AI generate study cards for you
                </p>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => setMode("pdf")} className="text-left">
            <Card className="hover:border-primary/60 transition-colors h-full cursor-pointer">
              <CardHeader>
                <Upload className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Upload PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Upload a document and generate cards from its content
                </p>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => setMode("manual")} className="text-left">
            <Card className="hover:border-primary/60 transition-colors h-full cursor-pointer">
              <CardHeader>
                <Pencil className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Build Manually</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create a blank deck and add cards yourself
                </p>
              </CardContent>
            </Card>
          </button>
        </div>

        <Link
          href="/decks"
          className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setMode("choose"); setError(null); }}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold">
          {mode === "topic" && "Generate from Topic"}
          {mode === "pdf" && "Generate from PDF"}
          {mode === "manual" && "Build Manually"}
        </h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (mode === "topic" || mode === "pdf") && (
        <GenerationLoading />
      )}

      {(mode === "topic" || mode === "pdf") && !loading && (
        <form
          onSubmit={mode === "topic" ? handleTopicSubmit : handlePdfSubmit}
          className="space-y-4"
        >
          {mode === "pdf" && (
            <div className="space-y-2">
              <Label>PDF File</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors",
                  file && "border-primary bg-primary/5"
                )}
                onClick={() =>
                  document.getElementById("pdf-input")?.click()
                }
              >
                <input
                  id="pdf-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to upload a PDF
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="topic">
              {mode === "pdf" ? "Topic / Subject" : "Topic"}
            </Label>
            <Input
              id="topic"
              placeholder="e.g. Photosynthesis, World War II, Calculus Derivatives"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => v !== null && setDifficulty(v)}>
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardCount">
              Number of cards:{" "}
              <span className="font-bold text-primary">{cardCount}</span>
            </Label>
            <input
              id="cardCount"
              type="range"
              min={5}
              max={50}
              step={5}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Card types</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    typeMix.includes(t.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Generating..." : "Generate Cards"}
          </Button>
        </form>
      )}

      {mode === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-title">Deck Title</Label>
            <Input
              id="manual-title"
              placeholder="e.g. Biology Midterm"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-subject">Subject</Label>
            <Input
              id="manual-subject"
              placeholder="e.g. Biology"
              value={manualSubject}
              onChange={(e) => setManualSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-desc">Description (optional)</Label>
            <Textarea
              id="manual-desc"
              placeholder="What is this deck about?"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Deck"}
          </Button>
        </form>
      )}
    </div>
  );
}
