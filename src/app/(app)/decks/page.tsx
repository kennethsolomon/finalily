import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type DeckWithRelations = {
  id: string;
  title: string;
  subject: string;
  updatedAt: Date;
  cards: { id: string; isDraft: boolean }[];
  studySessions: {
    completedAt: Date | null;
    correctCount: number;
    totalCards: number;
  }[];
};
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, BookOpen, Clock, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DecksClientWrapper } from "./_components/decks-client-wrapper";

export default async function DecksPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const decks = await prisma.deck.findMany({
    where: { ownerId: authUser.id },
    orderBy: { updatedAt: "desc" },
    include: {
      cards: { select: { id: true, isDraft: true } },
      studySessions: {
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true, correctCount: true, totalCards: true },
      },
    },
  });

  const typedDecks = decks as unknown as DeckWithRelations[];
  const subjects: string[] = Array.from(new Set(typedDecks.map((d) => d.subject))).sort();

  const deckData = typedDecks.map((deck) => {
    const publishedCount = deck.cards.filter((c) => !c.isDraft).length;
    const lastSession = deck.studySessions[0] ?? null;
    const mastery =
      lastSession && lastSession.totalCards > 0
        ? Math.round((lastSession.correctCount / lastSession.totalCards) * 100)
        : null;

    return {
      id: deck.id,
      title: deck.title,
      subject: deck.subject,
      cardCount: publishedCount,
      draftCount: deck.cards.filter((c) => c.isDraft).length,
      updatedAt: deck.updatedAt.toISOString(),
      lastStudied: lastSession?.completedAt?.toISOString() ?? null,
      mastery,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deck Library</h1>
          <p className="text-muted-foreground">
            {decks.length} {decks.length === 1 ? "deck" : "decks"}
          </p>
        </div>
        <Link href="/decks/new" className={buttonVariants()}>
          <PlusCircle className="h-4 w-4 mr-2" />
          New Deck
        </Link>
      </div>

      <Separator />

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/40" />
          <div>
            <h2 className="text-xl font-semibold">No decks yet</h2>
            <p className="text-muted-foreground mt-1">
              Create your first deck to start studying
            </p>
          </div>
          <Link href="/decks/new" className={buttonVariants({ size: "lg" })}>
            <PlusCircle className="h-5 w-5 mr-2" />
            Create your first deck
          </Link>
        </div>
      ) : (
        <DecksClientWrapper decks={deckData} subjects={subjects} />
      )}
    </div>
  );
}
