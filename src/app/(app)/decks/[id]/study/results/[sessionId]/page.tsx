import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, RotateCcw, ArrowLeft, CalendarDays } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function StudyResultsPage({ params }: PageProps) {
  const { id: deckId, sessionId } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    include: {
      deck: { select: { id: true, title: true } },
      answers: {
        include: { card: { select: { id: true, prompt: true, answer: true, type: true } } },
      },
    },
  });

  if (!session || session.userId !== user.id) redirect(`/decks/${deckId}`);

  const total = session.totalCards;
  const correct = session.correctCount;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const durationSeconds = session.durationSeconds ?? 0;
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const duration = `${mins}m ${secs}s`;

  const answers = session.answers;
  const missedAnswers = answers.filter((a) => !a.isCorrect);

  const typeBreakdown: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    const cardType = a.card?.type ?? "UNKNOWN";
    if (!typeBreakdown[cardType]) typeBreakdown[cardType] = { correct: 0, total: 0 };
    typeBreakdown[cardType].total++;
    if (a.isCorrect) typeBreakdown[cardType].correct++;
  }
  const typeLabels: Record<string, string> = {
    FLASHCARD: "Flashcard",
    MCQ: "MCQ",
    IDENTIFICATION: "Identification",
    TRUE_FALSE: "True/False",
    CLOZE: "Cloze",
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86400000);

  const deckCards = await prisma.card.findMany({
    where: { deckId },
    select: { id: true },
  });
  const cardIdList = deckCards.map((c) => c.id);

  const dueTomorrow = cardIdList.length > 0
    ? await prisma.reviewSchedule.count({
        where: {
          userId: user.id,
          cardId: { in: cardIdList },
          nextReviewAt: { gte: tomorrowStart, lt: tomorrowEnd },
        },
      })
    : 0;

  const scoreColor =
    score >= 80
      ? "text-green-600 dark:text-green-400"
      : score >= 60
      ? "text-orange-500"
      : "text-destructive";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Session Complete
        </p>
        <p className={cn("text-6xl font-bold mb-1", scoreColor)}>{score}%</p>
        <p className="text-muted-foreground">
          {correct} / {total} correct
        </p>

        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="flex flex-col items-center gap-1">
            <Clock className="size-4 text-muted-foreground" />
            <span className="font-medium">{duration}</span>
            <span className="text-xs text-muted-foreground">Time</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <CheckCircle className="size-4 text-green-500" />
            <span className="font-medium">{correct}</span>
            <span className="text-xs text-muted-foreground">Correct</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <XCircle className="size-4 text-destructive" />
            <span className="font-medium">{total - correct}</span>
            <span className="text-xs text-muted-foreground">Missed</span>
          </div>
          {dueTomorrow > 0 && (
            <div className="flex flex-col items-center gap-1">
              <CalendarDays className="size-4 text-blue-500" />
              <span className="font-medium">{dueTomorrow}</span>
              <span className="text-xs text-muted-foreground">Due Tomorrow</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/decks/${deckId}`}
          className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
        >
          <ArrowLeft className="size-4" />
          Back to Deck
        </Link>
        {missedAnswers.length > 0 && (
          <Link
            href={`/decks/${deckId}/study?mode=quiz&retry=${sessionId}`}
            className={cn(buttonVariants(), "flex-1 gap-2")}
          >
            <RotateCcw className="size-4" />
            Retry Misses
          </Link>
        )}
      </div>

      {Object.keys(typeBreakdown).length > 1 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
            Accuracy by Card Type
          </h2>
          <div className="space-y-2">
            {Object.entries(typeBreakdown)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([type, stats]) => {
                const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{typeLabels[type] ?? type}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-bold",
                        pct >= 80 ? "text-green-600 dark:text-green-400" :
                        pct >= 60 ? "text-orange-500" : "text-destructive"
                      )}>
                        {pct}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({stats.correct}/{stats.total})
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {missedAnswers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Missed Cards ({missedAnswers.length})
          </h2>
          {missedAnswers.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"
            >
              <p className="text-sm font-medium mb-1">{a.card?.prompt}</p>
              <p className="text-xs text-muted-foreground">
                Correct answer:{" "}
                <span className="font-semibold text-foreground">{a.card?.answer}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {missedAnswers.length === 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          <CheckCircle className="size-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-green-700 dark:text-green-400">Perfect score!</p>
          <p className="text-sm text-muted-foreground">You answered every card correctly.</p>
        </div>
      )}
    </div>
  );
}
