"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Save,
  Trash2,
  Check,
  Plus,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDeckWithCards, updateDeck } from "@/actions/decks";
import {
  createCard,
  updateCard,
  deleteCard,
  publishCard,
  reorderCards,
} from "@/actions/cards";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CARD_TYPE_LABELS: Record<string, string> = {
  FLASHCARD: "Flashcard",
  MCQ: "Multiple Choice",
  IDENTIFICATION: "Identification",
  TRUE_FALSE: "True / False",
  CLOZE: "Fill in the Blank",
};

const CARD_TYPE_DESCRIPTIONS: Record<string, string> = {
  FLASHCARD: "Flip to reveal the answer",
  MCQ: "Pick the correct option",
  IDENTIFICATION: "Type the answer",
  TRUE_FALSE: "True or false statement",
  CLOZE: "Fill in {{blanks}} in a sentence",
};

const CARD_TYPE_SHORT: Record<string, string> = {
  FLASHCARD: "Flashcard",
  MCQ: "MCQ",
  IDENTIFICATION: "ID",
  TRUE_FALSE: "T/F",
  CLOZE: "Cloze",
};

const CARD_TYPE_COLORS: Record<string, string> = {
  FLASHCARD: "bg-blue-100 text-blue-700",
  MCQ: "bg-purple-100 text-purple-700",
  IDENTIFICATION: "bg-green-100 text-green-700",
  TRUE_FALSE: "bg-orange-100 text-orange-700",
  CLOZE: "bg-pink-100 text-pink-700",
};

type CardRow = {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  options: unknown;
  cloze_text: string | null;
  is_draft: boolean;
  position: number;
};

type Deck = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  cards: CardRow[];
};

function SortableCardItem({
  card,
  idx,
  editingCardId,
  editPrompt,
  editAnswer,
  editExplanation,
  editOptions,
  saving,
  setEditPrompt,
  setEditAnswer,
  setEditExplanation,
  setEditOptions,
  onSaveCard,
  onCancelEdit,
  onStartEdit,
  onDeleteCard,
  onPublishCard,
}: {
  card: CardRow;
  idx: number;
  editingCardId: string | null;
  editPrompt: string;
  editAnswer: string;
  editExplanation: string;
  editOptions: string[];
  saving: boolean;
  setEditPrompt: (v: string) => void;
  setEditAnswer: (v: string) => void;
  setEditExplanation: (v: string) => void;
  setEditOptions: (v: string[]) => void;
  onSaveCard: (id: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (card: CardRow) => void;
  onDeleteCard: (id: string) => void;
  onPublishCard: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-4",
        card.is_draft && "border-dashed border-amber-300 bg-amber-50/40",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {editingCardId === card.id ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Prompt</Label>
            <Textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={2}
            />
          </div>
          {card.type === "MCQ" ? (
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              {editOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...editOptions];
                      next[i] = e.target.value;
                      setEditOptions(next);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setEditAnswer(opt)}
                    className={cn(
                      "shrink-0 text-xs px-2 py-1 rounded border transition-colors",
                      editAnswer === opt && opt.trim()
                        ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {editAnswer === opt && opt.trim() ? "Correct" : "Set correct"}
                  </button>
                </div>
              ))}
              {editOptions.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditOptions([...editOptions, ""])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add option
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Answer</Label>
              <Input
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Explanation</Label>
            <Textarea
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSaveCard(card.id)}
              disabled={saving}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          </button>
          <span className="text-xs text-muted-foreground mt-0.5 w-5 shrink-0">
            {idx + 1}
          </span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded font-medium shrink-0",
              CARD_TYPE_COLORS[card.type] ?? "bg-muted text-muted-foreground"
            )}
          >
            {CARD_TYPE_SHORT[card.type] ?? card.type}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{card.prompt}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {card.answer}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {card.is_draft && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => onPublishCard(card.id)}
                title="Publish"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onStartEdit(card)}
              title="Edit"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDeleteCard(card.id)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Badge
              variant={card.is_draft ? "outline" : "secondary"}
              className={cn(
                "text-xs ml-1",
                card.is_draft && "border-amber-400 text-amber-700"
              )}
            >
              {card.is_draft ? "Draft" : "Published"}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditDeckPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deckId = params.id;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deck metadata form
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Card being edited
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>(["", "", "", ""]);

  // New card form
  const [showNewCard, setShowNewCard] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newType, setNewType] = useState<"FLASHCARD" | "MCQ" | "IDENTIFICATION" | "TRUE_FALSE" | "CLOZE">("FLASHCARD");
  const [newOptions, setNewOptions] = useState<string[]>(["", "", "", ""]);
  const [newClozeText, setNewClozeText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadDeck = useCallback(async () => {
    try {
      const data = await getDeckWithCards(deckId);
      setDeck(data as unknown as Deck);
      setTitle(data.title);
      setSubject(data.subject);
      setDescription(data.description ?? "");
    } catch {
      setError("Deck not found or unauthorized");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  async function handleSaveDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateDeck(deckId, {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
      });
      await loadDeck();
      toast.success("Deck saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function startEditCard(card: CardRow) {
    setEditingCardId(card.id);
    setEditPrompt(card.type === "CLOZE" && card.cloze_text ? card.cloze_text : card.prompt);
    setEditAnswer(card.answer);
    setEditExplanation(card.explanation ?? "");
    if (card.type === "MCQ" && Array.isArray(card.options)) {
      setEditOptions([...(card.options as string[])]);
    } else {
      setEditOptions(["", "", "", ""]);
    }
  }

  async function handleSaveCard(cardId: string) {
    setSaving(true);
    const card = cards.find((c) => c.id === cardId);
    const isCloze = card?.type === "CLOZE";

    // For cloze, extract blanks as the answer from the edited prompt (which contains {{blanks}})
    const updateData: Parameters<typeof updateCard>[1] = {
      prompt: isCloze ? editPrompt.replace(/\{\{([^}]+)\}\}/g, "___") : editPrompt.trim(),
      answer: isCloze ? (() => {
        const blanks: string[] = [];
        const regex = /\{\{([^}]+)\}\}/g;
        let m;
        while ((m = regex.exec(editPrompt)) !== null) blanks.push(m[1].trim());
        return blanks.join(", ");
      })() : editAnswer.trim(),
      explanation: editExplanation.trim() || undefined,
    };
    if (isCloze) {
      updateData.clozeText = editPrompt.trim();
    }
    if (card?.type === "MCQ") {
      const filteredOptions = editOptions.filter((o) => o.trim());
      if (!filteredOptions.includes(editAnswer.trim())) {
        toast.error("The correct answer must be one of the options");
        setSaving(false);
        return;
      }
      updateData.options = filteredOptions;
    }

    try {
      await updateCard(cardId, updateData);
      setEditingCardId(null);
      await loadDeck();
      toast.success("Card saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save card";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCard(cardId: string) {
    try {
      await deleteCard(cardId);
      await loadDeck();
      toast.success("Card deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete card";
      toast.error(msg);
      setError(msg);
    }
  }

  async function handlePublishCard(cardId: string) {
    try {
      await publishCard(cardId);
      await loadDeck();
      toast.success("Card published");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish card";
      toast.error(msg);
      setError(msg);
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newPrompt.trim() && newType !== "CLOZE") return;
    if (newType === "CLOZE" && !newClozeText.trim()) return;

    // Validate type-specific requirements
    if (newType === "MCQ") {
      const filledOptions = newOptions.filter((o) => o.trim());
      if (filledOptions.length < 2) return;
      if (!newAnswer.trim()) return;
    } else if (newType !== "CLOZE" && !newAnswer.trim()) {
      return;
    }

    setSaving(true);
    try {
      // For cloze, extract blanks as the answer
      let clozeAnswer = "";
      if (newType === "CLOZE") {
        const blanks: string[] = [];
        const regex = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = regex.exec(newClozeText)) !== null) {
          blanks.push(match[1].trim());
        }
        clozeAnswer = blanks.join(", ");
      }

      const cardData: Parameters<typeof createCard>[0] = {
        deckId,
        type: newType,
        prompt: newType === "CLOZE" ? newClozeText.replace(/\{\{([^}]+)\}\}/g, "___") : newPrompt.trim(),
        answer: newType === "CLOZE" ? clozeAnswer : newType === "TRUE_FALSE" ? newAnswer : newAnswer.trim(),
        explanation: newExplanation.trim() || undefined,
      };

      if (newType === "MCQ") {
        cardData.options = newOptions.filter((o) => o.trim());
      }
      if (newType === "CLOZE") {
        cardData.clozeText = newClozeText.trim();
      }

      await createCard(cardData);
      setNewPrompt("");
      setNewAnswer("");
      setNewExplanation("");
      setNewOptions(["", "", "", ""]);
      setNewClozeText("");
      setShowNewCard(false);
      await loadDeck();
      toast.success("Card added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add card";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !deck) return;

    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(cards, oldIndex, newIndex);
    setDeck({ ...deck, cards: reordered });

    try {
      await reorderCards(deckId, reordered.map((c) => c.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reorder";
      toast.error(msg);
      setError(msg);
      await loadDeck();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">{error ?? "Deck not found"}</p>
        <Link href="/decks">
          <Button variant="outline">Back to decks</Button>
        </Link>
      </div>
    );
  }

  const cards = (deck.cards ?? []) as CardRow[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/decks/${deckId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Edit Deck</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Deck metadata form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveDeck} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Cards section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cards ({cards.length})</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowNewCard(!showNewCard)}
        >
          <Plus className="h-4 w-4" />
          Add Card
        </Button>
      </div>

      {/* New card form */}
      {showNewCard && (
        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <form onSubmit={handleAddCard} className="space-y-4">
              <div className="space-y-2">
                <Label>Card Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.entries(CARD_TYPE_LABELS) as [string, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setNewType(id as typeof newType);
                        setNewAnswer("");
                        setNewPrompt("");
                        setNewOptions(["", "", "", ""]);
                        setNewClozeText("");
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                        newType === id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{CARD_TYPE_DESCRIPTIONS[id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CLOZE: special text input with blanks */}
              {newType === "CLOZE" ? (
                <div className="space-y-2">
                  <Label htmlFor="new-cloze">Sentence with blanks</Label>
                  <Textarea
                    id="new-cloze"
                    value={newClozeText}
                    onChange={(e) => setNewClozeText(e.target.value)}
                    rows={3}
                    required
                    placeholder='Use {{double braces}} for blanks. e.g. "The {{mitochondria}} is the powerhouse of the cell"'
                  />
                  <p className="text-xs text-muted-foreground">
                    Wrap answers in {"{{braces}}"} — they become the blanks students fill in.
                  </p>
                </div>
              ) : (
                <>
                  {/* Prompt / Question */}
                  <div className="space-y-2">
                    <Label htmlFor="new-prompt">
                      {newType === "TRUE_FALSE" ? "Statement" : "Question / Prompt"}
                    </Label>
                    <Textarea
                      id="new-prompt"
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      rows={2}
                      required
                      placeholder={
                        newType === "TRUE_FALSE"
                          ? "Enter a true or false statement..."
                          : newType === "MCQ"
                          ? "Enter the question..."
                          : "Enter the prompt..."
                      }
                    />
                  </div>

                  {/* MCQ: Options */}
                  {newType === "MCQ" && (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {newOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm font-bold text-muted-foreground w-6">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const next = [...newOptions];
                              next[i] = e.target.value;
                              setNewOptions(next);
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          />
                          <button
                            type="button"
                            onClick={() => setNewAnswer(opt)}
                            className={cn(
                              "shrink-0 text-xs px-2 py-1 rounded border transition-colors",
                              newAnswer === opt && opt.trim()
                                ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {newAnswer === opt && opt.trim() ? "Correct" : "Set correct"}
                          </button>
                        </div>
                      ))}
                      {newOptions.length < 6 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewOptions([...newOptions, ""])}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add option
                        </Button>
                      )}
                    </div>
                  )}

                  {/* TRUE_FALSE: toggle */}
                  {newType === "TRUE_FALSE" && (
                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewAnswer("true")}
                          className={cn(
                            "flex-1 rounded-lg border py-3 text-sm font-medium transition-colors",
                            newAnswer === "true"
                              ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          True
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewAnswer("false")}
                          className={cn(
                            "flex-1 rounded-lg border py-3 text-sm font-medium transition-colors",
                            newAnswer === "false"
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          False
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FLASHCARD / IDENTIFICATION: text answer */}
                  {(newType === "FLASHCARD" || newType === "IDENTIFICATION") && (
                    <div className="space-y-2">
                      <Label htmlFor="new-answer">Answer</Label>
                      <Input
                        id="new-answer"
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-explanation">Explanation (optional)</Label>
                <Textarea
                  id="new-explanation"
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Adding..." : "Add Card"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewCard(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Card list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {cards.map((card, idx) => (
              <SortableCardItem
                key={card.id}
                card={card}
                idx={idx}
                editingCardId={editingCardId}
                editPrompt={editPrompt}
                editAnswer={editAnswer}
                editExplanation={editExplanation}
                editOptions={editOptions}
                saving={saving}
                setEditPrompt={setEditPrompt}
                setEditAnswer={setEditAnswer}
                setEditExplanation={setEditExplanation}
                setEditOptions={setEditOptions}
                onSaveCard={handleSaveCard}
                onCancelEdit={() => setEditingCardId(null)}
                onStartEdit={startEditCard}
                onDeleteCard={handleDeleteCard}
                onPublishCard={handlePublishCard}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {cards.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No cards yet. Add one above or generate with AI.</p>
        </div>
      )}
    </div>
  );
}
