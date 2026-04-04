import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type CardRow = {
  id: string;
  type: string;
  prompt: string;
  answer: string;
  explanation: string | null;
  isDraft: boolean;
  position: number;
};
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Play,
  Share2,
  Pencil,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteDeckButton } from "./_components/delete-deck-button";

const CARD_TYPE_LABELS: Record<string, string> = {
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

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const deck = await prisma.deck.findUnique({
    where: { id },
    include: {
      cards: { orderBy: { position: "asc" } },
    },
  });

  if (!deck || deck.ownerId !== authUser.id) redirect("/decks");

  const cards: CardRow[] = deck.cards as CardRow[];
  const publishedCards = cards.filter((c) => !c.isDraft);
  const draftCards = cards.filter((c) => c.isDraft);

  // Health check: duplicate prompts, short answers (<10 chars), missing explanations
  const prompts = publishedCards.map((c) => c.prompt.toLowerCase().trim());
  const uniquePrompts = new Set(prompts);
  const duplicateCount = prompts.length - uniquePrompts.size;
  const shortAnswerCount = publishedCards.filter(
    (c) => c.answer.trim().length < 10
  ).length;
  const missingExplanationCount = publishedCards.filter(
    (c) => !c.explanation || c.explanation.trim().length === 0
  ).length;
  const healthIssues = duplicateCount + shortAnswerCount + missingExplanationCount;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="secondary">{deck.subject}</Badge>
            {deck.isShared && (
              <Badge variant="outline" className="text-xs">
                <Share2 className="h-3 w-3 mr-1" />
                Shared
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold break-words">{deck.title}</h1>
          {deck.description && (
            <p className="text-muted-foreground mt-1">{deck.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {publishedCards.length > 0 && (
            <Link
              href={`/decks/${id}/study`}
              className={cn(buttonVariants(), "gap-2")}
            >
              <Play className="h-4 w-4" />
              Study
            </Link>
          )}
          <Link
            href={`/decks/${id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <DeleteDeckButton deckId={id} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{cards.length}</p>
            <p className="text-xs text-muted-foreground">Total Cards</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{publishedCards.length}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{draftCards.length}</p>
            <p className="text-xs text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            healthIssues > 0 && "border-amber-300 bg-amber-50"
          )}
        >
          <CardContent className="pt-4">
            <p className="text-2xl font-bold flex items-center gap-1">
              {healthIssues > 0 && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {healthIssues}
            </p>
            <p className="text-xs text-muted-foreground">Health Issues</p>
          </CardContent>
        </Card>
      </div>

      {draftCards.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-800">
              {draftCards.length} AI-generated{" "}
              {draftCards.length === 1 ? "card" : "cards"} awaiting review
            </p>
            <p className="text-sm text-amber-700">
              Review and publish them to add to your deck.
            </p>
          </div>
          <Link
            href={`/decks/${id}/review`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
            )}
          >
            Review AI Cards
          </Link>
        </div>
      )}

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Cards ({deck.cards.length})
        </h2>
        {cards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No cards yet. Create some or generate with AI.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card: CardRow, idx: number) => (
              <div
                key={card.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border bg-card",
                  card.isDraft && "border-dashed border-amber-300 bg-amber-50/40"
                )}
              >
                <span className="text-xs text-muted-foreground mt-0.5 w-5 shrink-0">
                  {idx + 1}
                </span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded font-medium shrink-0",
                    CARD_TYPE_COLORS[card.type] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {CARD_TYPE_LABELS[card.type] ?? card.type}
                </span>
                <p className="flex-1 text-sm line-clamp-2">{card.prompt}</p>
                <Badge
                  variant={card.isDraft ? "outline" : "secondary"}
                  className={cn(
                    "shrink-0 text-xs",
                    card.isDraft && "border-amber-400 text-amber-700"
                  )}
                >
                  {card.isDraft ? "Draft" : "Published"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
