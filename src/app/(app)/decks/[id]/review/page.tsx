"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  ChevronDown,
  BookOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { publishCard, updateCard, deleteCard } from "@/actions/cards";
import { publishDeck } from "@/actions/decks";

type CardType = "FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE";

type DraftCard = {
  id: string;
  type: CardType;
  prompt: string;
  answer: string;
  explanation: string | null;
  options: unknown;
  clozeText: string | null;
  isDraft: boolean;
};

const CARD_TYPE_LABELS: Record<CardType, string> = {
  FLASHCARD: "Flashcard",
  MCQ: "Multiple Choice",
  IDENTIFICATION: "Identification",
  TRUE_FALSE: "True / False",
  CLOZE: "Fill-in-the-Blank",
};

const CARD_TYPE_COLORS: Record<CardType, string> = {
  FLASHCARD: "bg-blue-100 text-blue-700",
  MCQ: "bg-purple-100 text-purple-700",
  IDENTIFICATION: "bg-green-100 text-green-700",
  TRUE_FALSE: "bg-orange-100 text-orange-700",
  CLOZE: "bg-pink-100 text-pink-700",
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;

  const [cards, setCards] = useState<DraftCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editExplanation, setEditExplanation] = useState("");

  const fetchDraftCards = useCallback(async () => {
    try {
      const res = await fetch(`/api/decks/${deckId}/draft-cards`);
      if (!res.ok) throw new Error("Failed to fetch draft cards");
      const data: DraftCard[] = await res.json();
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchDraftCards();
  }, [fetchDraftCards]);

  const currentCard = cards[currentIndex] ?? null;
  const remaining = cards.length;
  const reviewedCount = reviewedIds.size;
  const progress =
    remaining === 0 ? 100 : Math.round((reviewedCount / (reviewedCount + remaining)) * 100);

  function startEdit(card: DraftCard) {
    setEditPrompt(card.prompt);
    setEditAnswer(card.answer);
    setEditExplanation(card.explanation ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function advance(removedId?: string) {
    setEditing(false);
    setCards((prev) => {
      const next = removedId ? prev.filter((c) => c.id !== removedId) : prev;
      return next;
    });
    if (removedId) {
      setReviewedIds((prev) => new Set([...prev, removedId]));
    }
    setCurrentIndex((prev) => {
      const newLen = removedId
        ? cards.length - 1
        : cards.length;
      return Math.min(prev, Math.max(0, newLen - 1));
    });
  }

  async function handleAccept() {
    if (!currentCard) return;
    setActionLoading(true);
    try {
      await publishCard(currentCard.id);
      advance(currentCard.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!currentCard) return;
    setActionLoading(true);
    try {
      const updated = await updateCard(currentCard.id, {
        prompt: editPrompt,
        answer: editAnswer,
        explanation: editExplanation,
      });
      setCards((prev) =>
        prev.map((c) =>
          c.id === currentCard.id ? { ...c, ...updated } : c
        )
      );
      setEditing(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!currentCard) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/generate/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id }),
      });
      if (!res.ok) throw new Error("Regeneration failed");
      const updated: DraftCard = await res.json();
      setCards((prev) =>
        prev.map((c) => (c.id === currentCard.id ? { ...c, ...updated } : c))
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemove() {
    if (!currentCard) return;
    setActionLoading(true);
    try {
      await deleteCard(currentCard.id);
      advance(currentCard.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChangeType(newType: CardType) {
    if (!currentCard) return;
    setActionLoading(true);
    try {
      const updated = await updateCard(currentCard.id, { type: newType });
      setCards((prev) =>
        prev.map((c) =>
          c.id === currentCard.id ? { ...c, ...updated } : c
        )
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePublishAll() {
    setActionLoading(true);
    try {
      await publishDeck(deckId);
      router.push(`/decks/${deckId}/study`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cards.length === 0 && reviewedCount === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <BookOpen className="h-14 w-14 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">No draft cards to review</h2>
        <p className="text-muted-foreground">All cards are already published.</p>
        <Link
          href={`/decks/${deckId}/study`}
          className={cn(buttonVariants(), "gap-2")}
        >
          Start Studying
        </Link>
      </div>
    );
  }

  if (cards.length === 0 && reviewedCount > 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <Check className="h-14 w-14 mx-auto text-green-500" />
        <h2 className="text-xl font-semibold">Deck ready!</h2>
        <p className="text-muted-foreground">
          You reviewed all {reviewedCount} cards.
        </p>
        <Link
          href={`/decks/${deckId}/study`}
          className={cn(buttonVariants(), "gap-2")}
        >
          Start Studying
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {reviewedCount} reviewed &bull; {cards.length} remaining
          </span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {currentCard && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded font-medium",
                CARD_TYPE_COLORS[currentCard.type]
              )}
            >
              {CARD_TYPE_LABELS[currentCard.type]}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>

          {!editing ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Prompt
                </p>
                <p className="text-base font-medium">{currentCard.prompt}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Answer
                </p>
                <p className="text-base">{currentCard.answer}</p>
              </div>

              {currentCard.explanation && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Explanation
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentCard.explanation}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Prompt</Label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Answer</Label>
                <Textarea
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Explanation</Label>
                <Textarea
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!editing && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                onClick={handleAccept}
                disabled={actionLoading}
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={() => startEdit(currentCard)}
                disabled={actionLoading}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={handleRegenerate}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleRemove}
                disabled={actionLoading}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5"
                  )}
                  disabled={actionLoading}
                >
                  Change Type
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((t) => (
                    <DropdownMenuItem
                      key={t}
                      onClick={() => handleChangeType(t)}
                      className={cn(currentCard.type === t && "font-medium")}
                    >
                      {CARD_TYPE_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}

      {reviewedCount >= Math.floor(cards.length * 0.5) && cards.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handlePublishAll}
            disabled={actionLoading}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Publish All Remaining
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setCurrentIndex((p) => Math.min(cards.length - 1, p + 1))
          }
          disabled={currentIndex >= cards.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
