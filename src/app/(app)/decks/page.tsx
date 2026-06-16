import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { Mascot } from "@/components/mascot";
import { PlusCircle } from "lucide-react";
import { DecksClientWrapper } from "./_components/decks-client-wrapper";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const user = await getSessionUser();

  if (!user) redirect("/auth/login");

  const decks = await prisma.deck.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      cards: { select: { id: true, isDraft: true } },
      studySessions: { select: { completedAt: true, correctCount: true, totalCards: true } },
    },
  });

  const allCardIds = decks.flatMap((d) => d.cards.map((c) => c.id));
  let reviewScheduleMap: Map<string, { easeFactor: number; cardId: string }[]> = new Map();
  let dueCountMap: Map<string, number> = new Map();

  if (allCardIds.length > 0) {
    const now = new Date();
    const schedules = await prisma.reviewSchedule.findMany({
      where: { userId: user.id, cardId: { in: allCardIds } },
      select: { cardId: true, easeFactor: true, nextReviewAt: true },
    });

    const cardToDeck: Record<string, string> = {};
    for (const deck of decks) {
      for (const card of deck.cards) {
        cardToDeck[card.id] = deck.id;
      }
    }

    for (const s of schedules) {
      const deckId = cardToDeck[s.cardId];
      if (!deckId) continue;

      if (!reviewScheduleMap.has(deckId)) reviewScheduleMap.set(deckId, []);
      reviewScheduleMap.get(deckId)!.push({ easeFactor: s.easeFactor, cardId: s.cardId });

      if (s.nextReviewAt <= now) {
        dueCountMap.set(deckId, (dueCountMap.get(deckId) ?? 0) + 1);
      }
    }
  }

  let focusDeckIds: Set<string> | null = null;

  if (focus === "weak") {
    const weakSchedules = await prisma.reviewSchedule.findMany({
      where: { userId: user.id, easeFactor: { lt: 2.0 } },
      select: { cardId: true },
    });
    const weakCardIds = weakSchedules.map((r) => r.cardId);
    const weakCards =
      weakCardIds.length > 0
        ? await prisma.card.findMany({
            where: { id: { in: weakCardIds } },
            select: { deckId: true },
          })
        : [];
    focusDeckIds = new Set(weakCards.map((c) => c.deckId));
  } else if (focus === "mistakes") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const mistakeAnswers = await prisma.sessionAnswer.findMany({
      where: {
        isCorrect: false,
        createdAt: { gte: sevenDaysAgo },
        session: { userId: user.id },
      },
      include: { card: { select: { deckId: true } } },
    });
    focusDeckIds = new Set(mistakeAnswers.map((a) => a.card.deckId));
  }

  const subjects: string[] = Array.from(
    new Set(decks.map((d) => d.subject))
  ).sort() as string[];

  const deckData = decks.map((deck) => {
    const publishedCount = deck.cards.filter((c) => !c.isDraft).length;
    const draftCount = deck.cards.filter((c) => c.isDraft).length;

    const completedSessions = deck.studySessions
      .filter((s) => s.completedAt !== null)
      .sort(
        (a, b) =>
          new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      );
    const lastSession = completedSessions[0] ?? null;

    const deckSchedules = reviewScheduleMap.get(deck.id) ?? [];
    let mastery: number | null = null;
    if (deckSchedules.length > 0) {
      const avgEase =
        deckSchedules.reduce((sum, s) => sum + s.easeFactor, 0) / deckSchedules.length;
      mastery = Math.round(
        Math.min(100, Math.max(0, ((avgEase - 1.3) / (3.0 - 1.3)) * 100))
      );
    }

    const dueCount = dueCountMap.get(deck.id) ?? 0;

    return {
      id: deck.id,
      title: deck.title,
      subject: deck.subject,
      cardCount: publishedCount,
      draftCount,
      updatedAt: deck.updatedAt.toISOString(),
      lastStudied: lastSession?.completedAt?.toISOString() ?? null,
      mastery,
      dueCount,
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
          <Mascot expression="sad" size={96} />
          <div>
            <h2 className="text-xl font-semibold">No decks yet</h2>
            <p className="text-muted-foreground mt-1">
              Lil&apos; Bit is waiting for your first deck!
            </p>
          </div>
          <Link href="/decks/new" className={buttonVariants({ size: "lg" })}>
            <PlusCircle className="h-5 w-5 mr-2" />
            Create your first deck
          </Link>
        </div>
      ) : (
        <DecksClientWrapper
          decks={deckData}
          subjects={subjects}
          focusDeckIds={focusDeckIds ? Array.from(focusDeckIds) : null}
          focusLabel={
            focus === "weak"
              ? "Weak Spots"
              : focus === "mistakes"
              ? "Recent Mistakes"
              : null
          }
        />
      )}
    </div>
  );
}
